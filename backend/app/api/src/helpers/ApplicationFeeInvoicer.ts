import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, BalanceItemPayment, Organization, Payment, StripeAccount, User } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { QueueHandler } from '@stamhoofd/queues';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, getPaymentProviderName, PaymentCustomer, PaymentMethod, PaymentProvider, PaymentStatus, PaymentType, TranslatedString } from '@stamhoofd/structures';
import { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
import { Formatter } from '@stamhoofd/utility';

import { ApplicationFeeService, FEE_PAYMENT_REFERENCE_PREFIX } from '../services/ApplicationFeeService.js';
import { PaymentService } from '../services/PaymentService.js';
import { SettlementService } from '../services/SettlementService.js';
import { VATService } from '../services/VATService.js';
import { StripeSettlementSync } from './StripeSettlementSync.js';
import { WebmasterReport } from './WebmasterReport.js';

/**
 * A month can hold hundreds of thousands of fees, so they are never all loaded at once: every pass
 * iterates them in batches of this size.
 */
const FEE_BATCH_SIZE = 500;

/**
 * How far back the invoicer bills automatically. Older fees need someone to look at why they were
 * never billed, instead of every run walking further and further back.
 */
const MAXIMUM_INVOICE_MONTHS = 12;

/**
 * Stored timestamps have no milliseconds, so a boundary compared against them may not either.
 */
function truncateToSecond(date: Date): Date {
    const truncated = new Date(date);
    truncated.setMilliseconds(0);
    return truncated;
}

/**
 * What one paying Stripe account owes for one month.
 */
type AccountTotals = {
    payingOrganizationId: string;
    amountPerType: Map<ApplicationFeeType, number>;
};

/**
 * Bills the stored application fees to the paying organizations: per (account, month) with
 * uninvoiced fees, one ServiceFee/TransferFee balance item pair paid by one AccountDeductions
 * payment (the fees were already deducted from the account's payouts).
 *
 * Idempotency is per fee: a fee with a balanceItemId is billed, everything else still needs
 * billing. A fee that arrives after its month was billed simply lands in an extra payment on the
 * next run. The payment reference is informational only.
 */
export class ApplicationFeeInvoicer {
    readonly #secretKey: string;

    constructor({ secretKey }: { secretKey: string }) {
        this.#secretKey = secretKey;
    }

    static reference(periodStart: Date): string {
        return FEE_PAYMENT_REFERENCE_PREFIX + Formatter.dateIso(periodStart);
    }

    /**
     * Bills every uninvoiced fee of the months before the current one.
     */
    async generateInvoices(sellingOrganization: Organization): Promise<void> {
        if (!sellingOrganization.meta.companies[0]) {
            return;
        }

        // A month that can't be billed usually can't be billed for any of its accounts either:
        // report all of them in one email instead of one per month per account
        await WebmasterReport.group('Aanrekenen applicatiekosten', async () => {
            await this.#billUninvoicedMonths(sellingOrganization);
        });
    }

    async #billUninvoicedMonths(sellingOrganization: Organization): Promise<void> {
        // Fees stored while this run is walking are excluded from every pass, so the totals a
        // balance item is created for and the fees stamped with it can't drift apart. Stored
        // createdAt has no milliseconds, so neither may this boundary
        const snapshot = truncateToSecond(new Date());

        const currentPeriodStart = SettlementService.getPeriodStart(new Date());
        const oldest = await this.#selectBillableFees(sellingOrganization)
            .where('occurredAt', '<', currentPeriodStart)
            .where('createdAt', '<', snapshot)
            .orderBy('occurredAt', 'ASC')
            .first(false);

        if (!oldest) {
            return;
        }

        // A month that can't be billed (its data needs repair first) stays uninvoiced, so without a
        // window every following run would walk it again, forever
        const windowStart = new Date(currentPeriodStart.getFullYear(), currentPeriodStart.getMonth() - MAXIMUM_INVOICE_MONTHS, 1);
        const oldestMonth = SettlementService.getPeriodStart(oldest.occurredAt);

        if (oldestMonth < windowStart) {
            WebmasterReport.report(
                'Applicatiekosten van voor ' + Formatter.dateIso(windowStart) + ' worden niet meer aangerekend',
                'Er staan nog niet-aangerekende applicatiekosten van ' + Formatter.dateIso(oldestMonth) + '. Die maand valt buiten het venster van ' + MAXIMUM_INVOICE_MONTHS + ' maanden en wordt niet meer automatisch aangerekend.',
            );
        }

        const platformSync = new StripeSettlementSync({ secretKey: this.#secretKey });
        let month = oldestMonth < windowStart ? windowStart : oldestMonth;

        while (month < currentPeriodStart) {
            const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);

            // Walking a month at Stripe is expensive: only months that still owe us something
            if (!await this.#hasUninvoicedFees(sellingOrganization, month, nextMonth, snapshot)) {
                month = nextMonth;
                continue;
            }

            // Only a complete, error-free fee walk may invoice the month: a missing fee means the
            // month waits (and someone gets an email), never a short invoice
            const { start, end } = SettlementService.getMonthUnixStartEnd(month);
            try {
                await platformSync.syncFees({ start: new Date(start * 1000), end: new Date(end * 1000) });
                await this.generateInvoicesForMonth(sellingOrganization, month, snapshot);
            } catch (e) {
                console.error('Invoicing application fees failed for month ' + Formatter.dateIso(month), e);
                WebmasterReport.report('Aanmaken kosten-facturatie voor ' + Formatter.dateIso(month) + ' overgeslagen', e);
            }

            month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
        }
    }

    async #hasUninvoicedFees(sellingOrganization: Organization, periodStart: Date, nextPeriodStart: Date, snapshot: Date): Promise<boolean> {
        return !!await this.#selectUninvoicedFees(sellingOrganization, periodStart, nextPeriodStart, snapshot).first(false);
    }

    /**
     * Bills the uninvoiced fees of one month, one payment per paying account. An error for one
     * account never affects the other accounts.
     */
    async generateInvoicesForMonth(sellingOrganization: Organization, month: Date, snapshot: Date = truncateToSecond(new Date())): Promise<void> {
        const periodStart = SettlementService.getPeriodStart(month);
        const nextPeriodStart = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1);
        const reference = ApplicationFeeInvoicer.reference(periodStart);

        await QueueHandler.schedule(reference, async () => {
            const totalsPerAccount = new Map<string, AccountTotals>();

            // Both ids are non-null: #selectUninvoicedFees only returns fees that can be billed
            for await (const fee of this.#selectUninvoicedFees(sellingOrganization, periodStart, nextPeriodStart, snapshot).all()) {
                const totals = totalsPerAccount.get(fee.payingStripeAccountId!) ?? {
                    payingOrganizationId: fee.payingOrganizationId!,
                    amountPerType: new Map<ApplicationFeeType, number>(),
                };
                totals.amountPerType.set(fee.type, (totals.amountPerType.get(fee.type) ?? 0) + fee.amount);
                totalsPerAccount.set(fee.payingStripeAccountId!, totals);
            }

            for (const [payingStripeAccountId, totals] of totalsPerAccount) {
                try {
                    await this.#invoiceGroup({ sellingOrganization, payingStripeAccountId, totals, periodStart, nextPeriodStart, snapshot });
                } catch (e) {
                    console.error('Invoicing application fees failed for account ' + payingStripeAccountId + ' - ' + reference, e);
                    WebmasterReport.report('Aanrekenen applicatiekosten voor ' + payingStripeAccountId + ' - ' + reference + ' mislukt', e);
                }
            }
        });
    }

    /**
     * A fee this invoicer cannot bill is left out everywhere, or every run would walk its month at
     * Stripe and report it again: without a paying organization there is nobody left to bill, and
     * without its Stripe account a month cannot be checked against what the legacy invoicer billed
     * per account — billing it anyway risks charging it twice. Both are reported by the sync that
     * stored them (StripeSettlementSync.reportUnattributedFee).
     */
    #selectUninvoicedFees(sellingOrganization: Organization, periodStart: Date, nextPeriodStart: Date, snapshot: Date) {
        return this.#selectBillableFees(sellingOrganization)
            .where('occurredAt', '>=', periodStart)
            .where('occurredAt', '<', nextPeriodStart)
            .where('createdAt', '<', snapshot)
            .limit(FEE_BATCH_SIZE);
    }

    #selectBillableFees(sellingOrganization: Organization) {
        return ApplicationFee.select()
            .where('organizationId', sellingOrganization.id)
            .where('balanceItemId', null)
            .where('payingOrganizationId', '!=', null)
            .where('payingStripeAccountId', '!=', null);
    }

    async #invoiceGroup({ sellingOrganization, payingStripeAccountId, totals, periodStart, nextPeriodStart, snapshot }: {
        sellingOrganization: Organization;
        payingStripeAccountId: string;
        totals: AccountTotals;
        periodStart: Date;
        nextPeriodStart: Date;
        snapshot: Date;
    }): Promise<void> {
        const seller = sellingOrganization.meta.companies[0];
        if (!seller) {
            return;
        }

        const stripeAccount = await StripeAccount.getByID(payingStripeAccountId);
        if (!stripeAccount) {
            throw new SimpleError({
                code: 'stripe_account_not_found',
                message: 'Stripe account ' + payingStripeAccountId + ' of uninvoiced application fees does not exist',
            });
        }

        const organization = await Organization.getByID(totals.payingOrganizationId);
        if (!organization) {
            throw new SimpleError({
                code: 'organization_not_found',
                message: 'No organization found for Stripe account ' + stripeAccount.accountId,
            });
        }

        // Uninvoiced fees in a month the legacy invoicer billed mean the inline legacy linking
        // failed (and already emailed): billing them again would charge the account twice
        const legacyPayments = await ApplicationFeeService.findLegacyFeePayments({
            organizationId: sellingOrganization.id,
            payingOrganizationId: organization.id,
            payingStripeAccountId: stripeAccount.id,
            periodStart,
        });
        if (legacyPayments.length > 0) {
            throw new SimpleError({
                code: 'legacy_month_not_linked',
                message: 'Month ' + Formatter.dateIso(periodStart) + ' was billed by the legacy invoicer but has uninvoiced fees: linking failed, not billing them again',
            });
        }

        await this.#assertNoOrphanedBalanceItems(sellingOrganization, stripeAccount.id, periodStart, nextPeriodStart);

        const customer = PaymentCustomer.create({
            company: organization.defaultCompanies[0],
        });

        if (customer.company!.isSameEntity(seller)) {
            throw new SimpleError({
                code: 'same_customer',
                message: 'Cannot invoice self',
            });
        }

        const totalAmount = [...totals.amountPerType.values()].reduce((total, amount) => total + amount, 0);
        if (totalAmount === 0) {
            return;
        }

        const monthEnd = new Date(nextPeriodStart.getTime() - 1000);
        const itemPerType = new Map<ApplicationFeeType, BalanceItem>();

        for (const type of [ApplicationFeeType.Service, ApplicationFeeType.Transfer]) {
            const amount = totals.amountPerType.get(type) ?? 0;
            if (amount === 0) {
                continue;
            }
            itemPerType.set(type, await this.#createBalanceItem({ sellingOrganization, organization, type, amount, periodStart, monthEnd }));
        }

        const balanceItems = [...itemPerType.values()];
        let total = 0;
        for (const balanceItem of balanceItems) {
            total += balanceItem.priceWithVAT;
        }
        if (total !== totalAmount) {
            throw new SimpleError({
                code: 'price_mismatched',
                message: 'The charged amount does not match the total application fee for the payment',
            });
        }

        // Stamp before creating the payment: a crash in between leaves detectable unpaid items
        // (see #assertNoOrphanedBalanceItems), never fees that get billed twice
        let stampedAmount = 0;
        for await (const fees of this.#selectUninvoicedFees(sellingOrganization, periodStart, nextPeriodStart, snapshot)
            .where('payingStripeAccountId', stripeAccount.id)
            .allBatched()) {
            for (const fee of fees) {
                const item = itemPerType.get(fee.type);
                if (!item) {
                    throw new SimpleError({
                        code: 'missing_balance_item',
                        message: 'No ' + fee.type + ' balance item was created for fee ' + fee.externalId,
                    });
                }
                await ApplicationFeeService.markInvoiced(fee, item.id, { payment: null });
                stampedAmount += fee.amount;
            }
        }

        if (stampedAmount !== totalAmount) {
            throw new SimpleError({
                code: 'price_mismatched',
                message: 'Stamped ' + stampedAmount + ' of application fees but billed ' + totalAmount,
            });
        }

        const systemUser = await User.getSystem();

        const payment = new Payment();
        payment.adminUserId = systemUser.id;

        // The receiver of the fees
        payment.organizationId = sellingOrganization.id;

        // The payer
        payment.payingOrganizationId = organization.id;
        payment.customer = customer;

        payment.status = PaymentStatus.Pending;
        payment.price = totalAmount;
        payment.roundingAmount = 0;
        payment.method = PaymentMethod.AccountDeductions;
        payment.type = PaymentType.Payment;
        payment.createMandate = null;
        payment.reference = ApplicationFeeInvoicer.reference(periodStart);

        payment.provider = PaymentProvider.Stripe;
        payment.stripeAccountId = stripeAccount.id;
        await payment.save();

        for (const balanceItem of balanceItems) {
            const balanceItemPayment = new BalanceItemPayment();
            balanceItemPayment.balanceItemId = balanceItem.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.organizationId = payment.organizationId;
            balanceItemPayment.price = balanceItem.priceWithVAT;
            await balanceItemPayment.save();
        }

        // Paid now, not in the billed month: the invoices cron only picks up recent payments, so a
        // month that is billed late would otherwise never end up on an invoice
        await PaymentService.handlePaymentStatusUpdate(payment, sellingOrganization, PaymentStatus.Succeeded, new Date());
        await SettlementService.updatePaymentSettlementsForAccountDeductionPayment(payment);
    }

    /**
     * A crash between stamping the fees and creating the payment leaves balance items without a
     * payment. Never bill on top of that: the totals of a new payment would no longer match the
     * items, someone has to repair first.
     */
    async #assertNoOrphanedBalanceItems(sellingOrganization: Organization, payingStripeAccountId: string, periodStart: Date, nextPeriodStart: Date): Promise<void> {
        const checked = new Set<string>();

        for await (const fees of ApplicationFee.select()
            .where('organizationId', sellingOrganization.id)
            .where('payingStripeAccountId', payingStripeAccountId)
            .where('balanceItemId', '!=', null)
            .where('occurredAt', '>=', periodStart)
            .where('occurredAt', '<', nextPeriodStart)
            .limit(FEE_BATCH_SIZE)
            .allBatched()) {
            const balanceItemIds = Formatter.uniqueArray(fees.map(fee => fee.balanceItemId!)).filter(id => !checked.has(id));
            if (balanceItemIds.length === 0) {
                continue;
            }
            balanceItemIds.forEach(id => checked.add(id));

            const balanceItemPayments = await BalanceItemPayment.select()
                .where('balanceItemId', balanceItemIds)
                .fetch();
            const paidItemIds = new Set(balanceItemPayments.map(b => b.balanceItemId));

            const orphaned = balanceItemIds.filter(id => !paidItemIds.has(id));
            if (orphaned.length > 0) {
                throw new SimpleError({
                    code: 'orphaned_balance_items',
                    message: 'Balance items ' + orphaned.join(', ') + ' bill application fees but have no payment: repair before invoicing more fees of this month',
                });
            }
        }
    }

    async #createBalanceItem({ sellingOrganization, organization, type, amount, periodStart, monthEnd }: {
        sellingOrganization: Organization;
        organization: Organization;
        type: ApplicationFeeType;
        amount: number;
        periodStart: Date;
        monthEnd: Date;
    }): Promise<BalanceItem> {
        const item = new BalanceItem();
        item.type = type === ApplicationFeeType.Service ? BalanceItemType.ServiceFee : BalanceItemType.TransferFee;
        item.description = type === ApplicationFeeType.Service
            ? $t('%1Wd', {
                    startDate: Formatter.startDate(periodStart, false, true),
                    endDate: Formatter.endDate(monthEnd, false, true),
                })
            : $t('%1Xx', {
                    startDate: Formatter.startDate(periodStart, false, true),
                    endDate: Formatter.endDate(monthEnd, false, true),
                });
        item.relations.set(BalanceItemRelationType.PaymentProvider, BalanceItemRelation.create({
            id: PaymentProvider.Stripe,
            name: TranslatedString.create(getPaymentProviderName(PaymentProvider.Stripe)),
        }));
        item.payingOrganizationId = organization.id;
        item.organizationId = sellingOrganization.id;
        item.VATPercentage = 21;
        item.VATExcempt = VATService.getVATExcempt({
            company: organization.defaultCompanies[0] ?? null,
            sellingOrganization,
            type: 'services',
        });
        item.VATIncluded = !item.VATExcempt; // Makes sure price with VAT always matches the charged amount
        item.quantity = 1;
        item.unitPrice = amount;
        item.createdAt = new Date();
        item.status = BalanceItemStatus.Hidden;
        item.startDate = periodStart;
        item.endDate = monthEnd;
        await item.save();
        return item;
    }
}
