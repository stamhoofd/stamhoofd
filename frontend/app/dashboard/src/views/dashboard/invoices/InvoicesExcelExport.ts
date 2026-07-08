import type { InvoiceStruct } from '@stamhoofd/structures';
import { PaymentMethod, PaymentMethodHelper } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import XLSX from 'xlsx';
import type { RowValue } from '../../../classes/ExcelHelper';
import { ExcelHelper } from '../../../classes/ExcelHelper';

export class InvoicesExcelExport {
    /**
     * List of all products for every order
     */
    static createSheet(invoices: InvoiceStruct[]): XLSX.WorkSheet {
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
                wsData.push([
                    ...(index === 0 ? invoiceColumns : emptyInvoiceColumns),
                    {
                        value: payment.price / 100_00,
                        format: '€0.00',
                    },
                    PaymentMethodHelper.getNameCapitalized(payment.method),
                    payment.method === PaymentMethod.Transfer ? 'Overschrijving' : (payment.settlement?.settledAt ? Formatter.dateIso(payment.settlement.settledAt) : '/'),
                    payment.method === PaymentMethod.Transfer ? (payment.transferDescription ?? '/') : (payment.settlement?.reference ?? '/'),
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

    static export(invoices: InvoiceStruct[]) {
        const wb = XLSX.utils.book_new();
        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, this.createSheet(invoices), 'Facturen');
        return XLSX.write(wb, { type: 'array' }) as Promise<ArrayBuffer>;
    }
}
