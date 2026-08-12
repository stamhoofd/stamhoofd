import type { CellValue } from '@stamhoofd/excel-writer';
import { ArchiverWriterAdapter, XlsxBuiltInNumberFormat, XlsxWriter } from '@stamhoofd/excel-writer';
import type { EmailInterfaceRecipient } from '@stamhoofd/email';
import { Email } from '@stamhoofd/email';
import type { Organization } from '@stamhoofd/models';
import { BalanceItemPayment, Invoice, Payment } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { SQL } from '@stamhoofd/sql';
import type { PaymentProvider } from '@stamhoofd/structures';
import { PaymentMethod } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { Formatter } from '@stamhoofd/utility';
import { Writable } from 'node:stream';

import { SettlementService } from '../services/SettlementService.js';

const SETTLEMENT_BATCH_SIZE = 100;

/**
 * A settlement can hold as many payment lines and charges as it settled payments, so they are
 * streamed in batches of this size.
 */
const ROW_BATCH_SIZE = 500;

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

    /**
     * The invoice id the charges are stamped with, or a derived month bucket while the invoice
     * document doesn't exist yet (`stamped` tells them apart).
     */
    invoiceId: string;
    stamped: boolean;

    /**
     * Whether the platform bills this itself, so the invoice behind it is one of ours to check.
     */
    isSellingOrganization: boolean;
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

    /**
     * The exported organization: the owner of the exported settlements.
     */
    organization: Organization;

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

    /**
     * Whether any exported payout is still waiting for application fees to be invoiced: only then
     * does that column say anything.
     */
    private hasPendingFees = false;

    /**
     * Same for fees of organizations that no longer exist: they are only ever received by the
     * platform, and even there they are the exception.
     */
    private hasUncollectibleFees = false;

    constructor({ start, end, provider, organization, sellingOrganization }: { start: Date; end: Date; provider?: PaymentProvider | null; organization: Organization; sellingOrganization: Organization }) {
        this.start = start;
        this.end = end;
        this.provider = provider ?? null;
        this.organization = organization;
        this.sellingOrganization = sellingOrganization;
    }

    private selectSettlements() {
        let query = Settlement.select()
            .where('organizationId', this.organization.id)
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
        await writer.ready();

        try {
            await this.writeSettlementSheets(writer, { settlementsSheet, paymentsSheet, chargesSheet });
            await this.writeProviderInvoices(writer, providerInvoicesSheet);
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
        // The settlement headers are small (one row per payout) and the batched iterator only
        // supports id order, so they are collected to sort them; everything that grows with the
        // number of payments streams per settlement below
        this.invoiceTotals.clear();

        const settlements: Settlement[] = [];
        for await (const batch of this.selectSettlements().limit(SETTLEMENT_BATCH_SIZE).allBatched()) {
            settlements.push(...batch);
        }
        settlements.sort((a, b) => a.settledAt.getTime() - b.settledAt.getTime() || a.externalId.localeCompare(b.externalId));

        // Only the organization that charges application fees ever receives any, so for everyone
        // else the columns would be empty
        this.hasPendingFees = settlements.some(settlement => settlement.pendingFees !== 0);
        this.hasUncollectibleFees = settlements.some(settlement => settlement.uncollectibleFees !== 0);

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
            ...(this.hasPendingFees ? [textCell('Niet-gefactureerde kosten', 22)] : []),
            ...(this.hasUncollectibleFees ? [textCell('Niet-aanrekenbare kosten', 22)] : []),
            textCell('Check', 20),
        ]);

        await writer.addRow(sheets.paymentsSheet, [
            textCell('Uitbetaling', 30),
            textCell('Uitbetaald op', 13),
            textCell('Betaling', 36),
            textCell('Type', 12),
            textCell('Bedrag', 13),
            textCell('Transactie', 30),
            textCell('Datum', 13),
            ...(this.organization.meta.invoicesEnabled
                ? [
                        textCell('Factuur', 15),
                        textCell('Factuurdatum', 13),
                        textCell('Factuurtotaal', 13),
                    ]
                : []),
        ]);

        await writer.addRow(sheets.chargesSheet, [
            textCell('Uitbetaling', 30),
            textCell('Type', 32),
            textCell('Bedrag', 13),
            textCell('Beschrijving', 45),
            textCell('Factuur provider', 18),
            textCell('Betaling', 36),
        ]);

        for (const settlement of settlements) {
            await this.writeSettlement(writer, sheets, settlement);
            this.callback?.();
        }
    }

    /**
     * The verdict of one payout: what it paid out has to be explained by its payments and its
     * costs. Fees we received but haven't invoiced yet have no payment line of their own, so they
     * explain their part of the difference until the invoicer creates one — that is missing data,
     * not a mismatch, and it says so. Fees of organizations that no longer exist explain their part
     * the same way, but never get a payment line: they are not waiting for anything.
     */
    static getSettlementCheck(settlement: Settlement, { linesTotal, chargesTotal }: { linesTotal: number; chargesTotal: number }): string {
        if (settlement.amount - linesTotal - chargesTotal - settlement.pendingFees - settlement.uncollectibleFees !== 0) {
            return 'Ontbrekende gegevens';
        }
        if (settlement.pendingFees !== 0) {
            return 'Kosten nog niet gefactureerd';
        }
        return '✓';
    }

    private async writeSettlement(writer: XlsxWriter, sheets: { settlementsSheet: symbol; paymentsSheet: symbol; chargesSheet: symbol }, settlement: Settlement) {
        const linesTotal = await this.writePaymentLines(writer, sheets.paymentsSheet, settlement);
        const chargesTotal = await this.writeCharges(writer, sheets.chargesSheet, settlement);

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
            { value: settlement.transactionCount },
            currencyCell(settlement.unexplainedAmount),
            ...(this.hasPendingFees ? [currencyCell(settlement.pendingFees)] : []),
            ...(this.hasUncollectibleFees ? [currencyCell(settlement.uncollectibleFees)] : []),
            textCell(SettlementExporter.getSettlementCheck(settlement, { linesTotal, chargesTotal })),
        ]);
    }

    /**
     * Streams the payment lines of one settlement, and returns their total.
     */
    private async writePaymentLines(writer: XlsxWriter, sheet: symbol, settlement: Settlement): Promise<number> {
        let total = 0;
        let index = 0;

        for await (const lines of PaymentSettlement.select()
            .where('settlementId', settlement.id)
            .limit(ROW_BATCH_SIZE)
            .allBatched()) {
            const payments = await Payment.select()
                .where('id', Formatter.uniqueArray(lines.map(l => l.paymentId)))
                .fetch();
            const invoiceIds = this.organization.meta.invoicesEnabled
                ? Formatter.uniqueArray(payments.map(p => p.invoiceId).filter((id): id is string => id !== null))
                : [];
            const invoices = invoiceIds.length > 0
                ? await Invoice.select().where('id', invoiceIds).fetch()
                : [];

            for (const line of lines) {
                const payment = payments.find(p => p.id === line.paymentId);
                const invoice = payment?.invoiceId ? invoices.find(i => i.id === payment.invoiceId) : undefined;
                await writer.addRow(sheet, [
                    index > 0 ? empty : textCell(settlement.externalId),
                    index > 0 ? empty : dateCell(settlement.settledAt),
                    textCell(line.paymentId),
                    textCell(payment?.type ?? ''),
                    currencyCell(line.amount),
                    textCell(line.externalId ?? ''),
                    dateCell(line.occurredAt),
                    ...(this.organization.meta.invoicesEnabled
                        ? [
                                textCell(invoice?.number ?? ''),
                                dateCell(invoice?.invoicedAt ?? null),
                                currencyCell(invoice ? invoice.totalWithVAT : null),
                            ]
                        : []),
                ]);
                total += line.amount;
                index += 1;
            }
        }

        if (index > 0) {
            await writer.addRow(sheet, []);
        }
        return total;
    }

    /**
     * Streams the charges of one settlement (also accumulating the provider invoice totals), and
     * returns their total.
     */
    private async writeCharges(writer: XlsxWriter, sheet: symbol, settlement: Settlement): Promise<number> {
        let total = 0;
        let index = 0;

        for await (const charges of SettlementCharge.select()
            .where('settlementId', settlement.id)
            .limit(ROW_BATCH_SIZE)
            .allBatched()) {
            for (const charge of charges) {
                await writer.addRow(sheet, [
                    index > 0 ? empty : textCell(settlement.externalId),
                    textCell(charge.type),
                    currencyCell(charge.amount),
                    textCell(charge.description),
                    textCell(charge.providerInvoiceId ?? ''),
                    textCell(charge.paymentId ?? ''),
                ]);

                this.addToProviderInvoice(settlement, charge);
                total += charge.amount;
                index += 1;
            }
        }

        if (index > 0) {
            await writer.addRow(sheet, []);
        }
        return total;
    }

    /**
     * The invoice that bills a charge to the exported organization. Three parties send such
     * invoices: the provider of the settlement (Mollie, and Stripe both for our platform account
     * and for Standard accounts) bills its own fees and their VAT; the platform membership
     * organization bills the application fees it deducted. Every other charge type is money
     * movement (transfers, reserves, disputes): no invoice bills those.
     */
    private getInvoicingParty(settlement: Settlement, charge: SettlementCharge): { invoicedBy: string; invoiceId: string; stamped: boolean; isSellingOrganization: boolean } | null {
        switch (charge.type) {
            case SettlementChargeType.ProviderTransactionFee:
            case SettlementChargeType.ProviderAccountFee:
            case SettlementChargeType.Tax:
                // A missing invoice id only happens for Mollie costs whose invoice document isn't
                // created yet: group those per month until it is
                return {
                    invoicedBy: settlement.provider,
                    invoiceId: charge.providerInvoiceId ?? (settlement.provider.toLowerCase() + '-' + SettlementService.getPeriodKey(charge.occurredAt)),
                    stamped: charge.providerInvoiceId !== null,
                    isSellingOrganization: false,
                };

            case SettlementChargeType.ApplicationFeeService:
            case SettlementChargeType.ApplicationFeeTransfer:
                // The Stamhoofd invoice number stamped when the fee payment was invoiced, or the
                // month bucket while that invoice doesn't exist yet
                return {
                    invoicedBy: this.sellingOrganization.name,
                    invoiceId: charge.providerInvoiceId ?? SettlementService.getPeriodKey(charge.occurredAt),
                    stamped: charge.providerInvoiceId !== null,
                    isSellingOrganization: true,
                };

            case SettlementChargeType.Reserve:
            case SettlementChargeType.BalanceMovement:
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

    /**
     * What the sheet adds to an invoice row: the charges of the same invoice that fall outside the
     * exported range, and whether the invoice bills exactly what was charged.
     */
    async getProviderInvoiceStatus(totals: ProviderInvoiceTotals): Promise<{ total: number; outsideExport: number | null; check: string }> {
        const total = totals.transactionFees + totals.serviceFees + totals.accountFees + totals.vat;
        const outsideExport = totals.stamped ? (await this.getInvoiceChargesTotal(totals.invoiceId)) - total : null;

        return {
            total,
            outsideExport,
            check: await this.getProviderInvoiceCheck(totals, total + (outsideExport ?? 0)),
        };
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
            textCell('Kosten buiten dit overzicht', 22),
            textCell('Check', 28),
        ]);

        for (const totals of this.getProviderInvoiceTotals()) {
            const { total, outsideExport, check } = await this.getProviderInvoiceStatus(totals);

            await writer.addRow(sheet, [
                textCell(totals.invoicedBy),
                textCell(totals.invoiceId),
                currencyCell(totals.transactionFees),
                currencyCell(totals.serviceFees),
                currencyCell(totals.accountFees),
                currencyCell(totals.vat),
                currencyCell(total),
                currencyCell(outsideExport),
                textCell(check),
            ]);
        }
    }

    /**
     * Everything the invoice bills the exported organization, also outside the exported range:
     * comparing a document against a partial sum would always mismatch. Scoped to the organization,
     * because a provider invoice id like `stripe-2026-01` groups the charges of every organization.
     */
    private async getInvoiceChargesTotal(providerInvoiceId: string): Promise<number> {
        const sum = await SettlementCharge.select()
            .where('providerInvoiceId', providerInvoiceId)
            .where('organizationId', this.organization.id)
            .sum(SQL.column('amount')) ?? 0;

        // Charges reduce the payout (negative); the invoice bills them as positive amounts
        return -sum;
    }

    /**
     * Whether the invoice bills exactly these charges. Only verifiable for the platform's own fee
     * invoices: the provider's documents (Stripe, Mollie) aren't stored locally.
     *
     * An invoice also bills everything else the organization owed that month (memberships,
     * packages), so it is not the invoice total that has to match, but the part of it that bills
     * these fees: the balance items the fees themselves point at.
     */
    private async getProviderInvoiceCheck(totals: ProviderInvoiceTotals, fullTotal: number): Promise<string> {
        if (!totals.isSellingOrganization) {
            return '';
        }

        if (!totals.stamped) {
            return 'Nog niet (volledig) gefactureerd';
        }

        const invoice = await Invoice.select()
            .where('organizationId', this.sellingOrganization.id)
            .where('number', totals.invoiceId)
            .first(false);

        if (!invoice) {
            return 'Nog niet (volledig) gefactureerd';
        }

        // What this invoice bills for exactly these fees: their balance items, as far as this
        // invoice's payments settled them
        const charges = await SettlementCharge.select()
            .where('providerInvoiceId', totals.invoiceId)
            .where('organizationId', this.organization.id)
            .fetch();
        const fees = charges.length > 0
            ? await ApplicationFee.select().where('settlementChargeId', charges.map(c => c.id)).fetch()
            : [];
        const balanceItemIds = Formatter.uniqueArray(fees.map(fee => fee.balanceItemId).filter((id): id is string => id !== null));
        if (balanceItemIds.length === 0) {
            return 'Nog niet (volledig) gefactureerd';
        }

        const invoicedPayments = await Payment.select()
            .where('invoiceId', invoice.id)
            .fetch();
        if (invoicedPayments.length === 0) {
            return 'Nog niet (volledig) gefactureerd';
        }

        const invoicedFees = await BalanceItemPayment.select()
            .where('balanceItemId', balanceItemIds)
            .where('paymentId', invoicedPayments.map(p => p.id))
            .sum(SQL.column('price')) ?? 0;

        if (invoicedFees !== fullTotal) {
            return 'Nog niet (volledig) gefactureerd';
        }
        return '✓';
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
