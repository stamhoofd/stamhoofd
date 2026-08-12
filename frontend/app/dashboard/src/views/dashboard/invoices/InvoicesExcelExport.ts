import type { InvoiceStruct, PaymentGeneral } from '@stamhoofd/structures';
import { PaymentMethod, PaymentMethodHelper, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import XLSX from 'xlsx';
import type { RowValue } from '../../../classes/ExcelHelper';
import { ExcelHelper } from '../../../classes/ExcelHelper';

/**
 * How long after a payment we still expect its payout to arrive: an incomplete payout younger than
 * this is 'not paid out yet', older it is a real mismatch.
 */
const EXPECTED_PAYOUT_DELAY_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Offline methods that never produce payout rows: money that arrived directly, so a succeeded
 * payment counts as completely paid out (a virtual payout at paidAt).
 */
const DIRECTLY_RECEIVED_METHODS = [PaymentMethod.Transfer, PaymentMethod.Unknown, PaymentMethod.PointOfSale];

export class InvoicesExcelExport {
    /**
     * List of all products for every order
     *
     * With `useStoredSettlements` the payout columns come from the stored settlement rows: one row
     * per payout a payment was part of, with the amount that payout contained of the payment. The
     * legacy blob shows one payout per payment at most.
     */
    static createSheet(invoices: InvoiceStruct[], { useStoredSettlements = false }: { useStoredSettlements?: boolean } = {}): XLSX.WorkSheet {
        /// Should we repeat all the duplicate fields for multiple lines in an order?

        // Columns
        const wsData: RowValue[][] = [
            [
                'Factuur',
                'Datum',
                'Klant',
                'Ondernemingsnummer',
                'BTW-nummer',
                'Adres',
                'Bedrag excl. BTW',
                'BTW',
                'Afrondingsverschil',
                'Totaal',
                ...(useStoredSettlements ? ['Uitbetaald?'] : []),
                'Betaling',
                'Betaalmethode',
                'Uitbetalingsdatum',
                'Uitbetalingsmededeling',
                'Uitbetalingsbedrag',
            ],
        ];

        for (const invoice of invoices) {
            const invoiceColumns: RowValue[] = [
                (invoice.number ?? '/') + '',
                invoice.invoicedAt ? Formatter.dateIso(invoice.invoicedAt) : '/',
                invoice.customer.dynamicName,
                invoice.customer.company?.companyNumber ?? '',
                invoice.customer.company?.VATNumber ?? '',
                invoice.customer.company?.address?.toString() ?? '',
                {
                    value: invoice.totalWithoutVAT / 100_00,
                    format: '€0.00',
                },
                {
                    value: invoice.VATTotalAmount / 100_00,
                    format: '€0.00',
                },
                {
                    value: invoice.payableRoundingAmount / 100_00,
                    format: '€0.00',
                },
                {
                    value: invoice.totalWithVAT / 100_00,
                    format: '€0.00',
                },
                ...(useStoredSettlements ? [this.getPayoutCheck(invoice)] : []),
            ];
            const emptyInvoiceColumns: RowValue[] = invoiceColumns.map(() => '');

            if (invoice.payments.length === 0) {
                wsData.push([
                    ...invoiceColumns,
                    '/',
                    '/',
                    '/',
                    '/',
                    '/',
                ]);
                continue;
            }

            for (const [index, payment] of invoice.payments.entries()) {
                const paymentColumns: RowValue[] = [
                    {
                        value: payment.price / 100_00,
                        format: '€0.00',
                    },
                    PaymentMethodHelper.getNameCapitalized(payment.method),
                ];
                const isTransfer = payment.method === PaymentMethod.Transfer && !payment.provider;

                if (useStoredSettlements && !isTransfer && payment.settlements.length > 0) {
                    for (const [lineIndex, line] of payment.settlements.entries()) {
                        wsData.push([
                            ...(index === 0 && lineIndex === 0 ? invoiceColumns : emptyInvoiceColumns),
                            ...(lineIndex === 0 ? paymentColumns : ['', '']),
                            Formatter.dateIso(line.settlement.settledAt),
                            line.settlement.reference || line.settlement.externalId,
                            {
                                value: line.amount / 100_00,
                                format: '€0.00',
                            },
                        ]);
                    }
                    continue;
                }

                wsData.push([
                    ...(index === 0 ? invoiceColumns : emptyInvoiceColumns),
                    ...paymentColumns,
                    isTransfer ? 'Overschrijving' : (payment.settlement?.settledAt ? Formatter.dateIso(payment.settlement.settledAt) : '/'),
                    isTransfer ? (payment.transferDescription ?? '/') : (payment.settlement?.reference ?? '/'),
                    {
                        value: payment.settlement?.amount ? payment.settlement.amount / 100_00 : 0,
                        format: '€0.00',
                    },
                ]);
            }
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13,
        });
    }

    /**
     * Whether the invoice is completely covered by payouts: the payout rows of its payments (plus
     * the virtual full payout of succeeded directly-received payments) must sum to the invoiced
     * payments total. Missing amounts of recent payments are still on their way; older ones are a
     * real problem. Never returns an empty string: an all-empty column would be dropped by
     * ExcelHelper.deleteEmptyColumns.
     */
    private static getPayoutCheck(invoice: InvoiceStruct): string {
        if (invoice.payments.length === 0) {
            return '/';
        }

        let covered = 0;
        let onlyRecentIncomplete = true;

        for (const payment of invoice.payments) {
            const paymentCovered = this.getCoveredAmount(payment);
            covered += paymentCovered;

            if (paymentCovered !== payment.price) {
                const referenceDate = payment.paidAt ?? payment.createdAt;
                if (Date.now() - referenceDate.getTime() > EXPECTED_PAYOUT_DELAY_MS) {
                    onlyRecentIncomplete = false;
                }
            }
        }

        if (covered === invoice.totalPaymentsAmount) {
            return '✓';
        }
        return onlyRecentIncomplete ? 'Nog niet (volledig) uitbetaald' : 'Klopt niet!';
    }

    private static getCoveredAmount(payment: PaymentGeneral): number {
        if (DIRECTLY_RECEIVED_METHODS.includes(payment.method)) {
            return payment.status === PaymentStatus.Succeeded ? payment.price : 0;
        }
        return payment.settlements.reduce((total, line) => total + line.amount, 0);
    }

    static export(invoices: InvoiceStruct[], options: { useStoredSettlements?: boolean } = {}) {
        const wb = XLSX.utils.book_new();
        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, this.createSheet(invoices, options), 'Facturen');
        return XLSX.write(wb, { type: 'array' }) as Promise<ArrayBuffer>;
    }
}
