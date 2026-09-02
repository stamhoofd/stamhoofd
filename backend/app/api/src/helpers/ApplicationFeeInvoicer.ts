import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, BalanceItemPayment, Organization, Payment, StripeAccount, User } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { QueueHandler } from '@stamhoofd/queues';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, getPaymentProviderName, PaymentCustomer, PaymentMethod, PaymentProvider, PaymentStatus, PaymentType, TranslatedString } from '@stamhoofd/structures';
import { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
import { Formatter, sleep } from '@stamhoofd/utility';

import { ApplicationFeeService, FEE_PAYMENT_REFERENCE_PREFIX } from '../services/ApplicationFeeService.js';
import { PaymentService } from '../services/PaymentService.js';
import { SettlementService } from '../services/SettlementService.js';
import { VATService } from '../services/VATService.js';
import { StripeSettlementSync } from './StripeSettlementSync.js';
import { WebmasterReport } from './WebmasterReport.js';

const FEE_BATCH_SIZE = 500;

/**
 * How far back the invoicer bills automatically. Older fees need someone to look at why they were
 * never billed, instead of every run walking further and further back.
 */
const MAXIMUM_INVOICE_MONTHS = 12;

// UTC days match Stripe's payout cutoffs
function startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function nextUtcDay(day: Date): Date {
    return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1));
}

function utcDateIso(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/**
 * Stored timestamps have no milliseconds, so a boundary compared against them may not either: a
 * boundary in the current second would miss what was stored earlier in it. Waits for the next
 * second, so everything stored before now lies before the boundary and everything stored after it
 * lies behind it.
 */
async function nextSecondBoundary(): Promise<Date> {
    const boundary = new Date();
    boundary.setMilliseconds(0);
    boundary.setSeconds(boundary.getSeconds() + 1);
    await sleep(boundary.getTime() - Date.now());
    return boundary;
}

type AccountTotals = {
    payingOrganizationId: string;
    amountPerType: Map<ApplicationFeeType, number>;
};

/**
 * Bills uninvoiced application fees per (paying account, UTC day): one ServiceFee/TransferFee
 * balance item pair paid by one AccountDeductions payment. A fee with a balanceItemId is billed.
 */
export class ApplicationFeeInvoicer {
    readonly #secretKey: string;
    readonly #reportedLegacyMonths = new Set<string>();

    constructor({ secretKey }: { secretKey: string }) {
        this.#secretKey = secretKey;
    }

    static reference(day: Date): string {
        return FEE_PAYMENT_REFERENCE_PREFIX + utcDateIso(day);
    }

    async generateInvoices(sellingOrganization: Organization): Promise<void> {
        if (!sellingOrganization.meta.companies[0]) {
            return;
        }

        await WebmasterReport.group('Aanrekenen applicatiekosten', async () => {
            await this.#billUninvoicedDays(sellingOrganization);
        });
    }

    async #billUninvoicedDays(sellingOrganization: Organization): Promise<void> {
        const today = startOfUtcDay(new Date());
        const oldest = await this.#selectBillableFees(sellingOrganization)
            .where('occurredAt', '<', today)
            .orderBy('occurredAt', 'ASC')
            .first(false);

        if (!oldest) {
            return;
        }

        const windowStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - MAXIMUM_INVOICE_MONTHS, 1));
        const oldestDay = startOfUtcDay(oldest.occurredAt);

        if (oldestDay < windowStart) {
            WebmasterReport.report(
                'Applicatiekosten van voor ' + utcDateIso(windowStart) + ' worden niet meer aangerekend',
                'Er staan nog niet-aangerekende applicatiekosten van ' + utcDateIso(oldestDay) + '. Die dag valt buiten het venster van ' + MAXIMUM_INVOICE_MONTHS + ' maanden en wordt niet meer automatisch aangerekend.',
            );
        }

        const platformSync = new StripeSettlementSync({ secretKey: this.#secretKey });
        let day = oldestDay < windowStart ? windowStart : oldestDay;

        while (day < today) {
            const next = await this.#selectBillableFees(sellingOrganization)
                .where('occurredAt', '>=', day)
                .where('occurredAt', '<', today)
                .orderBy('occurredAt', 'ASC')
                .first(false);
            if (!next) {
                break;
            }
            day = startOfUtcDay(next.occurredAt);
            const nextDay = nextUtcDay(day);

            try {
                await platformSync.syncFees({ start: day, end: new Date(nextDay.getTime() - 1000) });
                await this.generateInvoicesForDay(sellingOrganization, day);
            } catch (e) {
                console.error('Invoicing application fees failed for day ' + utcDateIso(day), e);
                WebmasterReport.report('Aanmaken kosten-facturatie voor ' + utcDateIso(day) + ' overgeslagen', e);
            }

            day = nextDay;
        }
    }

    async generateInvoicesForDay(sellingOrganization: Organization, day: Date, snapshot?: Date): Promise<void> {
        // Excludes fees stored during this run, so totals and stamped fees can't drift apart
        snapshot ??= await nextSecondBoundary();
        const periodStart = startOfUtcDay(day);
        const nextPeriodStart = nextUtcDay(periodStart);
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

    #selectUninvoicedFees(sellingOrganization: Organization, periodStart: Date, nextPeriodStart: Date, snapshot?: Date) {
        const query = this.#selectBillableFees(sellingOrganization)
            .where('occurredAt', '>=', periodStart)
            .where('occurredAt', '<', nextPeriodStart)
            .limit(FEE_BATCH_SIZE);
        return snapshot ? query.where('createdAt', '<', snapshot) : query;
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

        // Uninvoiced fees in a legacy-billed month mean linking failed: never bill them twice
        const legacyMonthStart = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), 1));
        const legacyPayments = await ApplicationFeeService.findLegacyFeePayments({
            organizationId: sellingOrganization.id,
            payingOrganizationId: organization.id,
            payingStripeAccountId: stripeAccount.id,
            periodStart: legacyMonthStart,
        });
        if (legacyPayments.length > 0) {
            const key = stripeAccount.id + ':' + utcDateIso(legacyMonthStart);
            if (this.#reportedLegacyMonths.has(key)) {
                return;
            }
            this.#reportedLegacyMonths.add(key);
            throw new SimpleError({
                code: 'legacy_month_not_linked',
                message: 'Month ' + Formatter.dateIso(legacyMonthStart) + ' was billed by the legacy invoicer but has uninvoiced fees: linking failed, not billing them again',
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

        const dayEnd = new Date(nextPeriodStart.getTime() - 1000);
        const itemPerType = new Map<ApplicationFeeType, BalanceItem>();

        for (const type of [ApplicationFeeType.Service, ApplicationFeeType.Transfer]) {
            const amount = totals.amountPerType.get(type) ?? 0;
            if (amount === 0) {
                continue;
            }
            itemPerType.set(type, await this.#createBalanceItem({ sellingOrganization, organization, type, amount, periodStart, dayEnd }));
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

        await PaymentService.handlePaymentStatusUpdate(payment, sellingOrganization, PaymentStatus.Succeeded, new Date());
        await SettlementService.updatePaymentSettlementsForApplicationFeePayment(payment);
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
                    message: 'Balance items ' + orphaned.join(', ') + ' bill application fees but have no payment: repair before invoicing more fees of this day',
                });
            }
        }
    }

    async #createBalanceItem({ sellingOrganization, organization, type, amount, periodStart, dayEnd }: {
        sellingOrganization: Organization;
        organization: Organization;
        type: ApplicationFeeType;
        amount: number;
        periodStart: Date;
        dayEnd: Date;
    }): Promise<BalanceItem> {
        const item = new BalanceItem();
        item.type = type === ApplicationFeeType.Service ? BalanceItemType.ServiceFee : BalanceItemType.TransferFee;
        const date = Formatter.date(periodStart, true, { timezone: 'UTC' });
        item.name = type === ApplicationFeeType.Service
            ? $t('Servicekosten op {date}', { date })
            : $t('Transactiekosten op {date}', { date });
        item.description = $t('Ingehouden via Stripe op {date} (UTC)', { date });
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
        item.endDate = dayEnd;
        await item.save();
        return item;
    }
}
