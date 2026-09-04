import { Database } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, BalanceItemPayment, Organization, Payment, StripeAccount, User } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL } from '@stamhoofd/sql';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, getPaymentProviderName, PaymentCustomer, PaymentMethod, PaymentProvider, PaymentStatus, PaymentType, TranslatedString } from '@stamhoofd/structures';
import { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
import { Formatter, sleep } from '@stamhoofd/utility';
import { DateTime } from 'luxon';

import { ApplicationFeeService, FEE_PAYMENT_REFERENCE_PREFIX, ORPHANED_FEE_DELAY_DAYS } from '../services/ApplicationFeeService.js';
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

function orphanedFeeCutoff(): Date {
    return new Date(Date.now() - ORPHANED_FEE_DELAY_DAYS * 24 * 60 * 60 * 1000);
}

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
    payingOrganizationId: string | null;
    payingStripeAccountId: string | null;
    amountPerType: Map<ApplicationFeeType, number>;
};

/**
 * Bills uninvoiced application fees per (paying organization, paying account, UTC day): one
 * ServiceFee/TransferFee balance item pair paid by one AccountDeductions payment. A fee with a
 * balanceItemId is billed. Fees whose payer was deleted are billed without one, so they can be
 * receipted manually.
 */
export class ApplicationFeeInvoicer {
    readonly #secretKey: string;

    constructor({ secretKey }: { secretKey: string }) {
        this.#secretKey = secretKey;
    }

    static reference(day: Date): string {
        return FEE_PAYMENT_REFERENCE_PREFIX + utcDateIso(day);
    }

    /**
     * The fees of a UTC day are booked at local midnight of that calendar date, so they land in the
     * same period as invoices and reports that use the platform timezone.
     */
    static paidAt(day: Date): Date {
        return DateTime.fromObject(
            { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate() },
            { zone: Formatter.timezone },
        ).toJSDate();
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
                await platformSync.syncFees({ start: day, end: nextDay });
                await this.generateInvoicesForDay(sellingOrganization, day);
            } catch (e) {
                console.error('Invoicing application fees failed for day ' + utcDateIso(day), e);
                WebmasterReport.report('Aanmaken kosten-facturatie voor ' + utcDateIso(day) + ' overgeslagen', e);
            }

            day = nextDay;
        }
    }

    async generateInvoicesForDay(sellingOrganization: Organization, day: Date): Promise<void> {
        // Excludes fees stored during this run, so totals and stamped fees can't drift apart
        const snapshot = await nextSecondBoundary();
        const orphanedBefore = orphanedFeeCutoff();
        const periodStart = startOfUtcDay(day);
        const nextPeriodStart = nextUtcDay(periodStart);
        const reference = ApplicationFeeInvoicer.reference(periodStart);

        await QueueHandler.schedule(reference, async () => {
            const totalsPerPayer = new Map<string, AccountTotals>();

            for await (const fee of this.#selectUninvoicedFees(sellingOrganization, periodStart, nextPeriodStart, snapshot, orphanedBefore).all()) {
                const key = (fee.payingOrganizationId ?? '') + ':' + (fee.payingStripeAccountId ?? '');
                const totals = totalsPerPayer.get(key) ?? {
                    payingOrganizationId: fee.payingOrganizationId,
                    payingStripeAccountId: fee.payingStripeAccountId,
                    amountPerType: new Map<ApplicationFeeType, number>(),
                };
                totals.amountPerType.set(fee.type, (totals.amountPerType.get(fee.type) ?? 0) + fee.amount);
                totalsPerPayer.set(key, totals);
            }

            for (const [key, totals] of totalsPerPayer) {
                try {
                    await this.#invoiceGroup({ sellingOrganization, totals, periodStart, nextPeriodStart, snapshot, orphanedBefore });
                } catch (e) {
                    console.error('Invoicing application fees failed for payer ' + key + ' - ' + reference, e);
                    WebmasterReport.report('Aanrekenen applicatiekosten voor ' + key + ' - ' + reference + ' mislukt', e);
                }
            }
        });
    }

    #selectUninvoicedFees(sellingOrganization: Organization, periodStart: Date, nextPeriodStart: Date, snapshot: Date, orphanedBefore: Date) {
        return this.#selectBillableFees(sellingOrganization, orphanedBefore)
            .where('occurredAt', '>=', periodStart)
            .where('occurredAt', '<', nextPeriodStart)
            .where('createdAt', '<', snapshot)
            .limit(FEE_BATCH_SIZE);
    }

    #selectBillableFees(sellingOrganization: Organization, orphanedBefore = orphanedFeeCutoff()) {
        return ApplicationFee.select()
            .where('organizationId', sellingOrganization.id)
            .where('balanceItemId', null)
            .where(
                SQL.where('payingOrganizationId', '!=', null)
                    .and('payingStripeAccountId', '!=', null)
                    .or('occurredAt', '<', orphanedBefore),
            );
    }

    async #invoiceGroup({ sellingOrganization, totals, periodStart, nextPeriodStart, snapshot, orphanedBefore }: {
        sellingOrganization: Organization;
        totals: AccountTotals;
        periodStart: Date;
        nextPeriodStart: Date;
        snapshot: Date;
        orphanedBefore: Date;
    }): Promise<void> {
        const seller = sellingOrganization.meta.companies[0];
        if (!seller) {
            return;
        }

        const stripeAccount = (totals.payingStripeAccountId ? await StripeAccount.getByID(totals.payingStripeAccountId) : null) ?? null;
        if (totals.payingStripeAccountId && !stripeAccount) {
            throw new SimpleError({
                code: 'stripe_account_not_found',
                message: 'Stripe account ' + totals.payingStripeAccountId + ' of uninvoiced application fees does not exist',
            });
        }

        const organization = (totals.payingOrganizationId ? await Organization.getByID(totals.payingOrganizationId) : null) ?? null;
        if (totals.payingOrganizationId && !organization) {
            throw new SimpleError({
                code: 'organization_not_found',
                message: 'Organization ' + totals.payingOrganizationId + ' of uninvoiced application fees does not exist',
            });
        }

        const customer = organization
            ? PaymentCustomer.create({
                    company: organization.defaultCompanies[0],
                })
            : null;

        if (customer?.company?.isSameEntity(seller)) {
            throw new SimpleError({
                code: 'same_customer',
                message: 'Cannot invoice self',
            });
        }

        const totalAmount = [...totals.amountPerType.values()].reduce((total, amount) => total + amount, 0);
        if (totalAmount === 0) {
            return;
        }

        const payment = await Database.beginTransaction(async () => {
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

            let stampedAmount = 0;
            for await (const fees of this.#selectUninvoicedFees(sellingOrganization, periodStart, nextPeriodStart, snapshot, orphanedBefore)
                .where('payingOrganizationId', totals.payingOrganizationId)
                .where('payingStripeAccountId', totals.payingStripeAccountId)
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

            // The payer, unless deleted
            payment.payingOrganizationId = organization?.id ?? null;
            payment.customer = customer;

            payment.status = PaymentStatus.Pending;
            payment.price = totalAmount;
            payment.roundingAmount = 0;
            payment.method = PaymentMethod.AccountDeductions;
            payment.type = PaymentType.Payment;
            payment.createMandate = null;
            payment.reference = ApplicationFeeInvoicer.reference(periodStart);

            payment.provider = PaymentProvider.Stripe;
            payment.stripeAccountId = stripeAccount?.id ?? null;
            await payment.save();

            for (const balanceItem of balanceItems) {
                const balanceItemPayment = new BalanceItemPayment();
                balanceItemPayment.balanceItemId = balanceItem.id;
                balanceItemPayment.paymentId = payment.id;
                balanceItemPayment.organizationId = payment.organizationId;
                balanceItemPayment.price = balanceItem.priceWithVAT;
                await balanceItemPayment.save();
            }

            return payment;
        });

        await PaymentService.handlePaymentStatusUpdate(payment, sellingOrganization, PaymentStatus.Succeeded, ApplicationFeeInvoicer.paidAt(periodStart));
        await SettlementService.updatePaymentSettlementsForApplicationFeePayment(payment);
    }

    async #createBalanceItem({ sellingOrganization, organization, type, amount, periodStart, dayEnd }: {
        sellingOrganization: Organization;
        organization: Organization | null;
        type: ApplicationFeeType;
        amount: number;
        periodStart: Date;
        dayEnd: Date;
    }): Promise<BalanceItem> {
        const item = new BalanceItem();
        item.type = type === ApplicationFeeType.Service ? BalanceItemType.ServiceFee : BalanceItemType.TransferFee;
        const date = Formatter.date(periodStart, true, { timezone: 'UTC' });
        item.name = type === ApplicationFeeType.Service
            ? $t('%1cJ', { date })
            : $t('%1Yq', { date });
        item.description = $t('%ZqV', { date });
        item.relations.set(BalanceItemRelationType.PaymentProvider, BalanceItemRelation.create({
            id: PaymentProvider.Stripe,
            name: TranslatedString.create(getPaymentProviderName(PaymentProvider.Stripe)),
        }));
        item.payingOrganizationId = organization?.id ?? null;
        item.organizationId = sellingOrganization.id;
        item.VATPercentage = 21;
        item.VATExcempt = VATService.getVATExcempt({
            company: organization?.defaultCompanies[0] ?? null,
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
