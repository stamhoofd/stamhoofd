import type { CellValue } from '@stamhoofd/excel-writer';
import { ArchiverWriterAdapter, XlsxBuiltInNumberFormat, XlsxWriter } from '@stamhoofd/excel-writer';
import type { EmailInterfaceRecipient } from '@stamhoofd/email';
import { Email } from '@stamhoofd/email';
import { Invoice, Organization, Payment, StripeAccount } from '@stamhoofd/models';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { SQL } from '@stamhoofd/sql';
import type { PaymentProvider } from '@stamhoofd/structures';
import { PaymentMethod, PaymentProvider as PaymentProviderEnum, PaymentStatus } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { Formatter } from '@stamhoofd/utility';
import { Writable } from 'node:stream';

import { SettlementService } from '../services/SettlementService.js';

const SETTLEMENT_BATCH_SIZE = 100;

const RECEIVED_FEE_TYPES = [SettlementChargeType.ReceivedApplicationFeeService, SettlementChargeType.ReceivedApplicationFeeTransfer];

function currencyCell(amount: number | null, width?: number): CellValue {
    return {
        value: amount === null ? null : amount / 1_0000,
        width,
        style: {
            numberFormat: {
                id: XlsxBuiltInNumberFormat.Currency2DecimalWithoutRed,
            },
        },
    };
}

function dateCell(date: Date | null, width?: number): CellValue {
    return {
        value: date,
        width,
        style: {
            numberFormat: {
                id: XlsxBuiltInNumberFormat.DateSlash,
            },
        },
    };
}

function textCell(value: string, width?: number): CellValue {
    return { value, width };
}

const empty = textCell('');

/**
 * The totals of one invoice the exported organization receives. Amounts are stored as billed
 * (positive).
 */
type ProviderInvoiceTotals = {
    invoicedBy: string;
    invoiceId: string;
    transactionFees: number;
    serviceFees: number;
    accountFees: number;
    vat: number;
};

/**
 * Builds the settlements reconciliation report of one organization from the stored tables only: no
 * provider API calls. The sheets stream per settlement batch, because payment_settlements grows
 * like payments.
 */
export class SettlementExporter {
    start: Date;
    end: Date;
    provider: PaymentProvider | null;
    organizationId: string;

    /**
     * True when the exported organization is the platform membership organization: its export is
     * the platform-wide one, so the invoicing check covers every organization.
     */
    platformScope: boolean;

    /**
     * The platform membership organization: the seller of the platform's fee invoices.
     */
    sellingOrganization: Organization;

    /**
     * Called per processed settlement, to report progress.
     */
    callback: (() => void) | null = null;

    /**
     * Invoice totals accumulated from the Kosten rows (settlements in range).
     */
    private invoiceTotals = new Map<string, ProviderInvoiceTotals>();

    constructor({ start, end, provider, organizationId, platformScope, sellingOrganization }: { start: Date; end: Date; provider?: PaymentProvider | null; organizationId: string; platformScope?: boolean; sellingOrganization: Organization }) {
        this.start = start;
        this.end = end;
        this.provider = provider ?? null;
        this.organizationId = organizationId;
        this.platformScope = platformScope ?? false;
        this.sellingOrganization = sellingOrganization;
    }

    private selectSettlements() {
        let query = Settlement.select()
            .where('organizationId', this.organizationId)
            .where('settledAt', '>=', this.start)
            .where('settledAt', '<=', this.end);

        if (this.provider) {
            query = query.where('provider', this.provider);
        }
        return query;
    }

    async build(): Promise<Buffer> {
        const chunks: Buffer[] = [];
        const output = new Writable({
            write(chunk: Buffer, _encoding, callback) {
                chunks.push(chunk);
                callback();
            },
        });
        const finishPromise = new Promise<void>((resolve, reject) => {
            output.on('finish', () => resolve());
            output.on('error', reject);
        });

        const zipWriterAdapter = new ArchiverWriterAdapter(output);
        const writer = new XlsxWriter(zipWriterAdapter);

        const settlementsSheet = await writer.addSheet('Uitbetalingen');
        const paymentsSheet = await writer.addSheet('Betalingen');
        const chargesSheet = await writer.addSheet('Kosten');
        const providerInvoicesSheet = await writer.addSheet('Facturen provider');
        const invoicingCheckSheet = await writer.addSheet('Controle facturatie');
        await writer.ready();

        try {
            await this.writeSettlementSheets(writer, { settlementsSheet, paymentsSheet, chargesSheet });
            await this.writeProviderInvoices(writer, providerInvoicesSheet);
            await this.writeInvoicingCheck(writer, invoicingCheckSheet);
            await writer.close();
        } catch (error) {
            await writer.abort();
            throw error;
        }

        await finishPromise;
        return Buffer.concat(chunks);
    }

    /**
     * Sheets 1-3 in one streaming pass over the settlements in range.
     */
    private async writeSettlementSheets(writer: XlsxWriter, sheets: { settlementsSheet: symbol; paymentsSheet: symbol; chargesSheet: symbol }) {
        await writer.addRow(sheets.settlementsSheet, [
            textCell('Provider', 10),
            textCell('Uitbetaling', 30),
            textCell('Referentie', 25),
            textCell('Uitbetaald op', 13),
            textCell('Bedrag', 13),
            textCell('Totaal betalingen', 16),
            textCell('Totaal kosten', 13),
            textCell('Status', 10),
            textCell('Gesynchroniseerd', 16),
            textCell('Transacties', 11),
            textCell('Onverklaard', 13),
            textCell('Check', 12),
        ]);

        await writer.addRow(sheets.paymentsSheet, [
            textCell('Uitbetaling', 30),
            textCell('Uitbetaald op', 13),
            textCell('Betaling', 36),
            textCell('Type', 12),
            textCell('Bedrag', 13),
            textCell('Transactie', 30),
            textCell('Datum', 13),
        ]);

        await writer.addRow(sheets.chargesSheet, [
            textCell('Uitbetaling', 30),
            textCell('Type', 32),
            textCell('Bedrag', 13),
            textCell('Beschrijving', 45),
            textCell('Factuur provider', 18),
            textCell('Periode', 13),
        ]);

        // The settlement headers are small (the heavy line/charge data still streams per batch),
        // and the batched iterator only supports id order
        const settlements: Settlement[] = [];
        for await (const batch of this.selectSettlements().limit(SETTLEMENT_BATCH_SIZE).allBatched()) {
            settlements.push(...batch);
        }
        settlements.sort((a, b) => a.settledAt.getTime() - b.settledAt.getTime() || a.externalId.localeCompare(b.externalId));

        for (let offset = 0; offset < settlements.length; offset += SETTLEMENT_BATCH_SIZE) {
            const batch = settlements.slice(offset, offset + SETTLEMENT_BATCH_SIZE);
            const settlementIds = batch.map(s => s.id);
            const lines = await PaymentSettlement.select().where('settlementId', settlementIds).fetch();
            const charges = await SettlementCharge.select().where('settlementId', settlementIds).fetch();
            const payments = lines.length > 0
                ? await Payment.select().where('id', Formatter.uniqueArray(lines.map(l => l.paymentId))).fetch()
                : [];

            for (const settlement of batch) {
                const settlementLines = lines.filter(l => l.settlementId === settlement.id);
                const settlementCharges = charges.filter(c => c.settlementId === settlement.id);
                await this.writeSettlement(writer, sheets, settlement, settlementLines, settlementCharges, payments);
                this.callback?.();
            }
        }
    }

    private async writeSettlement(writer: XlsxWriter, sheets: { settlementsSheet: symbol; paymentsSheet: symbol; chargesSheet: symbol }, settlement: Settlement, lines: PaymentSettlement[], charges: SettlementCharge[], payments: Payment[]) {
        const linesTotal = lines.reduce((total, line) => total + line.amount, 0);
        const chargesTotal = charges.reduce((total, charge) => total + charge.amount, 0);
        const unexplained = settlement.amount - linesTotal - chargesTotal;

        // The payout amount must be explained by its payments and charges:
        // amount = totaal betalingen + totaal kosten
        await writer.addRow(sheets.settlementsSheet, [
            textCell(settlement.provider),
            textCell(settlement.externalId),
            textCell(settlement.reference),
            dateCell(settlement.settledAt),
            currencyCell(settlement.amount),
            currencyCell(linesTotal),
            currencyCell(chargesTotal),
            textCell(settlement.status),
            textCell(settlement.syncedAt ? '✓' : 'Niet gesynchroniseerd'),
            textCell(settlement.transactionCount.toString()),
            currencyCell(settlement.unexplainedAmount),
            textCell(unexplained === 0 ? '✓' : 'Klopt niet!'),
        ]);

        for (const [index, line] of lines.entries()) {
            const payment = payments.find(p => p.id === line.paymentId);
            await writer.addRow(sheets.paymentsSheet, [
                index > 0 ? empty : textCell(settlement.externalId),
                index > 0 ? empty : dateCell(settlement.settledAt),
                textCell(line.paymentId),
                textCell(payment?.type ?? ''),
                currencyCell(line.amount),
                textCell(line.externalId),
                dateCell(line.occurredAt),
            ]);
        }

        if (lines.length > 0) {
            await writer.addRow(sheets.paymentsSheet, []);
        }

        for (const [index, charge] of charges.entries()) {
            await writer.addRow(sheets.chargesSheet, [
                index > 0 ? empty : textCell(settlement.externalId),
                textCell(charge.type),
                currencyCell(charge.amount),
                textCell(charge.description),
                textCell(charge.providerInvoiceId ?? ''),
                dateCell(SettlementService.getPeriodStart(charge.occurredAt)),
            ]);

            this.addToProviderInvoice(settlement, charge);
        }

        if (charges.length > 0) {
            await writer.addRow(sheets.chargesSheet, []);
        }
    }

    /**
     * The invoice that bills a charge to the exported organization. Three parties send such
     * invoices: the provider of the settlement (Mollie, and Stripe both for our platform account
     * and for Standard accounts) bills its own fees and their VAT; the platform membership
     * organization bills the application fees it deducted, with its monthly fee invoice. Every
     * other charge type is money movement (transfers, reserves, disputes, the received mirror side
     * of application fees): no invoice bills those.
     */
    private getInvoicingParty(settlement: Settlement, charge: SettlementCharge): { invoicedBy: string; invoiceId: string } | null {
        switch (charge.type) {
            case SettlementChargeType.ProviderTransactionFee:
            case SettlementChargeType.ProviderAccountFee:
            case SettlementChargeType.Tax:
                // A missing invoice id only happens for Mollie costs whose invoice document isn't
                // created yet: group those per month until it is
                return {
                    invoicedBy: settlement.provider,
                    invoiceId: charge.providerInvoiceId ?? (settlement.provider.toLowerCase() + '-' + SettlementService.getPeriodKey(charge.occurredAt)),
                };

            case SettlementChargeType.ApplicationFeeService:
            case SettlementChargeType.ApplicationFeeTransfer:
                // Billed per month by the platform's fee invoicers: the month bucket is the invoice
                return {
                    invoicedBy: this.sellingOrganization.name,
                    invoiceId: SettlementService.getPeriodKey(charge.occurredAt),
                };

            case SettlementChargeType.ReceivedApplicationFeeService:
            case SettlementChargeType.ReceivedApplicationFeeTransfer:
            case SettlementChargeType.ApplicationFeeRefund:
            case SettlementChargeType.Transfer:
            case SettlementChargeType.TransferReversal:
            case SettlementChargeType.Reserve:
            case SettlementChargeType.Adjustment:
                return null;
        }
    }

    private addToProviderInvoice(settlement: Settlement, charge: SettlementCharge) {
        const invoice = this.getInvoicingParty(settlement, charge);
        if (!invoice) {
            return;
        }

        const key = invoice.invoicedBy + ':' + invoice.invoiceId;
        const totals = this.invoiceTotals.get(key) ?? { ...invoice, transactionFees: 0, serviceFees: 0, accountFees: 0, vat: 0 };

        // Charges reduce the payout (negative); the invoice bills them as positive amounts
        const billed = -charge.amount;
        switch (charge.type) {
            case SettlementChargeType.ProviderTransactionFee:
            case SettlementChargeType.ApplicationFeeTransfer:
                totals.transactionFees += billed;
                break;
            case SettlementChargeType.ApplicationFeeService:
                totals.serviceFees += billed;
                break;
            case SettlementChargeType.ProviderAccountFee:
                totals.accountFees += billed;
                break;
            default:
                totals.vat += billed;
        }
        this.invoiceTotals.set(key, totals);
    }

    /**
     * One row per invoice the exported organization receives: the stored fee rows that the invoice
     * document must match — Mollie's and Stripe's own invoices, and the platform's monthly fee
     * invoice (so an organization can verify what the platform billed them). Derived only from the
     * settlements this export selected, so it always agrees with the Kosten sheet; comparing with
     * the real document is the human step.
     */
    /**
     * The accumulated invoice rows (after build), sorted as the sheet writes them.
     */
    getProviderInvoiceTotals(): ProviderInvoiceTotals[] {
        return [...this.invoiceTotals.values()].sort((a, b) => a.invoicedBy.localeCompare(b.invoicedBy) || a.invoiceId.localeCompare(b.invoiceId));
    }

    private async writeProviderInvoices(writer: XlsxWriter, sheet: symbol) {
        await writer.addRow(sheet, [
            textCell('Gefactureerd door', 17),
            textCell('Factuur', 20),
            textCell('Transactiekosten', 16),
            textCell('Servicekosten', 16),
            textCell('Accountkosten', 16),
            textCell('BTW', 13),
            textCell('Totaal', 13),
        ]);

        for (const totals of this.getProviderInvoiceTotals()) {
            const total = totals.transactionFees + totals.serviceFees + totals.accountFees + totals.vat;

            await writer.addRow(sheet, [
                textCell(totals.invoicedBy),
                textCell(totals.invoiceId),
                currencyCell(totals.transactionFees),
                currencyCell(totals.serviceFees),
                currencyCell(totals.accountFees),
                currencyCell(totals.vat),
                currencyCell(total),
            ]);
        }
    }

    /**
     * One row per (organization, month): the stored Received fee rows next to the AccountDeductions
     * payment the old invoicer created. Every row must show a difference of 0,00: that is the
     * go/no-go check for the invoicer switch. The platform export covers every organization; an
     * organization's own export only shows its own rows.
     */
    private async writeInvoicingCheck(writer: XlsxWriter, sheet: symbol) {
        await writer.addRow(sheet, [
            textCell('Stripe account', 36),
            textCell('Maand', 13),
            textCell('Opgeslagen kosten', 17),
            textCell('Aangerekend', 13),
            textCell('Verschil', 13),
            textCell('Check', 12),
            textCell('Factuur', 25),
        ]);

        // Group the stored Received rows per (account, month of the fee's created date): the same
        // bucket the invoicer bills by. Extended to whole months, or a range ending mid-month
        // would compare a partial sum against the full month's fee payment
        const rangeEnd = new Date(this.end.getFullYear(), this.end.getMonth() + 1, 1);
        const groups = new Map<string, { stripeAccountId: string | null; periodStart: Date; total: number }>();
        let receivedQuery = SettlementCharge.select()
            .where('type', RECEIVED_FEE_TYPES)
            .where('occurredAt', '>=', SettlementService.getPeriodStart(this.start))
            .where('occurredAt', '<', rangeEnd);
        if (!this.platformScope) {
            receivedQuery = receivedQuery.where('organizationId', this.organizationId);
        }
        for await (const rows of receivedQuery
            .limit(SETTLEMENT_BATCH_SIZE)
            .allBatched()) {
            for (const row of rows) {
                const periodStart = SettlementService.getPeriodStart(row.occurredAt);
                const key = (row.stripeAccountId ?? 'unknown') + ':' + periodStart.getTime();
                const group = groups.get(key) ?? { stripeAccountId: row.stripeAccountId, periodStart, total: 0 };
                group.total += row.amount;
                groups.set(key, group);
            }
        }

        const sorted = [...groups.values()].sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime() || (a.stripeAccountId ?? '').localeCompare(b.stripeAccountId ?? ''));

        for (const group of sorted) {
            const { payment, invoiceNumber, organizationName } = await this.findFeePayment(group.stripeAccountId, group.periodStart);
            const charged = payment?.price ?? 0;
            const difference = group.total - charged;

            await writer.addRow(sheet, [
                textCell(organizationName ?? (group.stripeAccountId ?? 'Onbekend')),
                dateCell(group.periodStart),
                currencyCell(group.total),
                currencyCell(payment ? charged : null),
                currencyCell(payment ? difference : null),
                // A month the invoicer didn't reach yet is not a mismatch: it is still waiting
                textCell(payment ? (difference === 0 ? '✓' : 'Klopt niet!') : 'Nog niet gefactureerd'),
                textCell(payment ? (invoiceNumber ?? 'Betaling nog niet gefactureerd') : ''),
            ]);
        }
    }

    private async findFeePayment(stripeAccountId: string | null, periodStart: Date): Promise<{ payment: Payment | null; invoiceNumber: string | null; organizationName: string | null }> {
        if (!stripeAccountId) {
            return { payment: null, invoiceNumber: null, organizationName: null };
        }

        const stripeAccount = await StripeAccount.getByID(stripeAccountId);
        if (!stripeAccount) {
            return { payment: null, invoiceNumber: null, organizationName: null };
        }

        const organization = await Organization.getByID(stripeAccount.organizationId);
        const organizationName = organization ? organization.name + ' (' + stripeAccount.accountId + ')' : null;

        const reference = 'stripe-fees-' + Formatter.dateIso(periodStart);

        // Same query as the invoicer's idempotency check (the OR NULL covers legacy payments)
        const payment = await Payment.select()
            .where('organizationId', this.sellingOrganization.id)
            .where('payingOrganizationId', stripeAccount.organizationId)
            .where(
                SQL.where('stripeAccountId', stripeAccount.id)
                    .or('stripeAccountId', null),
            )
            .where('reference', reference)
            .where('method', PaymentMethod.AccountDeductions)
            .where('provider', PaymentProviderEnum.Stripe)
            .where('status', PaymentStatus.Succeeded)
            .first(false);

        if (!payment) {
            return { payment: null, invoiceNumber: null, organizationName };
        }

        const invoice = payment.invoiceId ? await Invoice.getByID(payment.invoiceId) : null;
        return { payment, invoiceNumber: invoice?.number !== null && invoice?.number !== undefined ? ('Factuur ' + invoice.number) : null, organizationName };
    }

    async sendEmail({ to }: { to: EmailInterfaceRecipient[] }): Promise<void> {
        const buffer = await this.build();

        const startMonth = Formatter.dateWithoutDay(this.start, { timezone: 'UTC' });
        const endMonth = Formatter.dateWithoutDay(this.end, { timezone: 'UTC' });
        const subject = 'Uitbetalingen export ' + startMonth + ((endMonth !== startMonth) ? (' - ' + endMonth) : '');

        Email.send({
            from: Email.getWebmasterFromEmail(),
            to,
            subject,
            text: 'In bijlage het overzicht van de opgeslagen uitbetalingen van ' + Formatter.dateTime(this.start) + ' tot ' + Formatter.dateTime(this.end) + '.\n',
            type: 'transactional',
            attachments: [
                {
                    filename: Formatter.fileSlug(subject) + '.xlsx',
                    content: buffer,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
            ],
        });
    }
}
