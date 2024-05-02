import { CheckoutMethodType, Order, OrderStatusHelper, PaymentMethod, STInvoicePrivate } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import XLSX from "xlsx";

export class InvoicesExcelExport {

    /**
     * List of all products for every order
     */
    static createSheet(invoices: STInvoicePrivate[]): XLSX.WorkSheet {
        /// Should we repeat all the duplicate fields for multiple lines in an order?
        
        // Columns
        const wsData: (string | number)[][] = [
            [
                "Factuur",
                "Datum",
                "Klant",
                "Ondernemingsnummer",
                "BTW-nummer",
                "Adres",
                "Bedrag excl. BTW",
                "BTW",
                "Bedrag incl. BTW",
                "Uitbetalingsdatum",
                "Uitbetalingsmededeling",
                "Uitbetalingsbedrag"
            ],
        ];

        for (const invoice of invoices) {
            wsData.push([
                (invoice.number?? "/")+"",
                Formatter.dateIso(invoice.createdAt ?? new Date()),
                invoice.meta.companyName || invoice.meta.companyContact,
                invoice.meta.companyNumber ?? "/",
                invoice.meta.companyVATNumber ?? "/",
                invoice.meta.companyAddress+"",
                invoice.meta.priceWithoutVAT / 100,
                invoice.meta.VAT / 100,
                invoice.meta.priceWithVAT / 100,
                invoice.payment?.method === PaymentMethod.Transfer ? "Overschrijving" : (invoice.settlement?.settledAt ? Formatter.dateIso(invoice.settlement.settledAt) : "/"),
                invoice.payment?.method === PaymentMethod.Transfer ? (invoice.payment.transferDescription ?? "/") : (invoice.settlement?.reference ?? "/"),
                invoice.settlement?.amount ? invoice.settlement?.amount / 100 : 0,
            ]);
        }

        const ws = XLSX.utils.aoa_to_sheet(wsData, { cellStyles: true });
        this.formatColumn(wsData[0].length - 6, "€0.00", ws)
        this.formatColumn(wsData[0].length - 5, "€0.00", ws)
        this.formatColumn(wsData[0].length - 4, "€0.00", ws)
        this.formatColumn(wsData[0].length - 1, "€0.00", ws)

        // Set column width
        ws['!cols'] = []
        for (const column of wsData[0]) {
            if (typeof column !== "string") {
                continue
            }
            if (column.toLowerCase().startsWith("naam")) {
                ws['!cols'].push({width: 20});
            } else if (column.toLowerCase().includes("naam")) {
                ws['!cols'].push({width: 15});
            } else if (column.toLowerCase().includes("e-mail")) {
                ws['!cols'].push({width: 25});
            } else if (column.toLowerCase().includes("adres")) {
                ws['!cols'].push({width: 30});
            } else if (column.toLowerCase().includes("gsm")) {
                ws['!cols'].push({width: 16});
            } else if (column.toLowerCase().includes("product")) {
                ws['!cols'].push({width: 40});
            } else {
                ws['!cols'].push({width: 13});
            }
        }

        return ws
    }

    static formatColumn(colNum: number, fmt: string, worksheet: any) {
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for(let i = range.s.r + 1; i <= range.e.r; ++i) {
            /* find the data cell (range.s.r + 1 skips the header row of the worksheet) */
            const ref = XLSX.utils.encode_cell({r:i, c:colNum});
            /* if the particular row did not contain data for the column, the cell will not be generated */
            if(!worksheet[ref]) continue;
            /* `.t == "n"` for number cells */
            if(worksheet[ref].t != 'n') continue;
            /* assign the `.z` number format */
            worksheet[ref].z = fmt;
        }
    }

    static wrapColumn(colNum: number, worksheet: any) {
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for(let i = range.s.r + 1; i <= range.e.r; ++i) {
            /* find the data cell (range.s.r + 1 skips the header row of the worksheet) */
            const ref = XLSX.utils.encode_cell({r:i, c:colNum});
            /* if the particular row did not contain data for the column, the cell will not be generated */
            if(!worksheet[ref]) continue;
            worksheet[ref].s = { alignment: { wrapText: true } }
        }
    }

    static deleteEmptyColumns(wsData: (string | number)[][]) {
        // Delete empty columns
        for (let index = wsData[0].length - 1; index >= 0; index--) {
            let empty = true
            for (const row of wsData.slice(1)) {
                const value = row[index]
                if (typeof value != "string") {
                    if (value == 0) {
                        // If all zero: empty
                        continue;
                    }
                    empty = false
                    break
                }
                if (value.length == 0 || value == "/") {
                    continue;
                }
                empty = false
                break
            }
            if (empty) {
                for (const row of wsData) {
                    row.splice(index, 1)
                } 
            }
        }
    }

    static export(invoices: STInvoicePrivate[]) {
        const wb = XLSX.utils.book_new();
        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, this.createSheet(invoices), "Facturen");
        return XLSX.write(wb, { type: "array" })
    }
}
