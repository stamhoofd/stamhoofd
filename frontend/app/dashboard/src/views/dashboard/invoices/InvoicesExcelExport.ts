import type { InvoiceStruct } from '@stamhoofd/structures';
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
                'Uitbetalingsdatum',
                'Uitbetalingsmededeling',
                'Uitbetalingsbedrag'
            ],
        ];

        for (const invoice of invoices) {
            wsData.push([
                (invoice.number?? '/')+'',
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

                // todo (can be more than one date)
                'Uitbetalingsdatum',
                'Uitbetalingsmededeling',
                'Uitbetalingsbedrag'
            ]);
        }

       return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13,
        });
    }

    static export(invoices: InvoiceStruct[]) {
        const wb = XLSX.utils.book_new();
        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, this.createSheet(invoices), 'Facturen');
        return XLSX.write(wb, { type: 'array' }) as Promise<ArrayBuffer>
    }
}
