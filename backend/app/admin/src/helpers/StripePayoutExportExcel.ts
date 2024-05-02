import { STInvoice, StripePayout, StripePayoutBreakdown, StripePayoutExport, StripePayoutItem, StripePayoutItemType } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import XLSX from "xlsx";

import { ExcelHelper, RowValue } from './ExcelHelper';

export class StripePayoutExportExcel {

    /**
     * List of all products for every order
     */
    static createPayouts(includedPayouts: StripePayoutBreakdown[], allPayouts: StripePayoutBreakdown[]): XLSX.WorkSheet {
        // Columns
        const wsData: RowValue[][] = [
            [
                "Datum",
                "Uitbetaald bedrag",
                "Naam",
                "Bedrag",
                "Beschrijving"
            ],
        ];

        for (const breakdown of includedPayouts.sort((b, a) => Sorter.byDateValue(a.payout.arrivalDate, b.payout.arrivalDate))) {
            for (const [index, item] of breakdown.items.sort((a,b) => Sorter.byStringValue(a.name, b.name)).entries()) {
                wsData.push([
                    index > 0 ? '' : {
                        value: breakdown.payout.arrivalDate,
                        format: 'dd/mm/yyyy'
                    },
                    index > 0 ? '' : {
                        value: breakdown.payout.amount / 100,
                        format: '€0.00'
                    },
                    item.name,
                    {
                        value: item.amount / 100,
                        format: '€0.00'
                    },
                    item.description
                ]);
            }

            // Include total line
            const total = breakdown.items.reduce((total, item) => total + item.amount, 0)
            wsData.push([
                '',
                '',
                'Totaal',
                {
                    value: total / 100,
                    format: '€0.00'
                },
                total === breakdown.payout.amount ? '✓' : 'Klopt niet!',
                '',
            ]);

            // Empty line
            wsData.push([])
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13
        })
    }

    /**
     * Group by invoices
     */
    static createInvoices(includedPayouts: StripePayoutBreakdown[], allPayouts: StripePayoutBreakdown[]): XLSX.WorkSheet {
        // Columns
        const wsData: RowValue[][] = [
            [
                "Factuur",
                "Factuurdatum",
                "Factuurbedrag (incl. BTW)",
                "Uitbetalingdatum",
                "Uitbetaald bedrag",
                "Opmerking",
                
                "Klant",
                "Ondernemingsnummer",
                "BTW-nummer",
                "Adres",
            ],
        ];

        // Group all data by invoice number
        const groupedInvoices = new Map<string, {
            invoice: STInvoice,
            items: {item: StripePayoutItem, payout: StripePayout}[]
        }>();

        for (const breakdown of allPayouts) {
            for (const item of breakdown.items) {
                for (const invoice of item.invoices) {
                    const key = invoice.number!.toString();
                    const list = groupedInvoices.get(key) ?? {
                        invoice,
                        items: []
                    };
                    list.items.push({
                        item,
                        payout: breakdown.payout
                    });
                    groupedInvoices.set(key, list);
                }
            }
        }

        for (const group of [...groupedInvoices.values()].sort((b, a) => Sorter.byNumberValue(a.invoice.number ?? 0, b.invoice.number ?? 0))) {
            const number = group.invoice.number ?? '?';
            
            // Skip invoices that are not for the included payouts
            if (!includedPayouts.some(p => p.items.some(i => i.invoices.some(inv => inv.number === number)))) {
                continue;
            }

            for (const [index, item] of group.items.sort((b, a) => Sorter.byDateValue(a.payout.arrivalDate, b.payout.arrivalDate)).entries()) {
                wsData.push([
                    index > 0 ? '' : number,
                    index > 0 ? '' : {
                        value: group.invoice.createdAt ?? '?',
                        format: 'dd/mm/yyyy'
                    },
                    
                    index > 0 ? '' : {
                        value: group.invoice.meta.priceWithVAT / 100,
                        format: '€0.00'
                    },
                    {
                        value: item.payout.arrivalDate,
                        format: 'dd/mm/yyyy'
                    },
                    {
                        value: item.item.amount / 100,
                        format: '€0.00'
                    },
                    '',
                    
                    index > 0 ? '' : (group.invoice.meta.companyName || group.invoice.meta.companyContact),
                    index > 0 ? '' : (group.invoice.meta.companyNumber ?? "/"),
                    index > 0 ? '' : (group.invoice.meta.companyVATNumber ?? "/"),
                    index > 0 ? '' : (group.invoice.meta.companyAddress+""),
                ]);
            }

            // Include total line
            const total = group.items.reduce((total, item) => total + item.item.amount, 0)
            wsData.push([
                '',
                '',
                '',
                '',
                {
                    value: total / 100,
                    format: '€0.00'
                },
                total === group.invoice.meta.priceWithVAT ? '✓' : 'Nog onvolledig',
                
                '',
                '',
                '',
                '',
            ]);

            // Empty line
            wsData.push([])
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13
        })
    }

    /**
     * Group by invoices
     */
    static createStripeInvoices(includedPayouts: StripePayoutBreakdown[], allPayouts:  StripePayoutBreakdown[]): XLSX.WorkSheet {
        // Columns
        const wsData: RowValue[][] = [
            [
                "Periode",
                "Afgehouden bedrag",
                "Uitbetalingsdatum",
                "Beschrijving"
            ],
        ];

        // Group all data by Stipre Invoice
        const groupedInvoices = new Map<string, {item: StripePayoutItem, payout: StripePayout}[]>();

        for (const breakdown of allPayouts) {
            for (const item of breakdown.items) {
                if (item.type !== StripePayoutItemType.StripeFees) {
                    continue;
                }

                const groupName = item.description;
                const list = groupedInvoices.get(groupName) ?? [];
                groupedInvoices.set(groupName, list);
                list.push({
                    item,
                    payout: breakdown.payout
                });
            }
        }

        for (const [period, group] of groupedInvoices) {
            // Do not include invoices that have no payout in the period
            if (!group.find(g => includedPayouts.find(p => p.payout.id === g.payout.id))) {
                // Likely not completely fetched: don't include it
                continue;
            }

            for (const [index, item] of group.entries()) {
                wsData.push([
                    index > 0 ? '' : period,
                    {
                        value: -item.item.amount / 100,
                        format: '€0.00'
                    },
                    {
                        value: item.payout.arrivalDate,
                        format: 'dd/mm/yyyy'
                    },
                    '',
                ]);
            }

            // Include total line
            const total = -group.reduce((total, item) => total + item.item.amount, 0)
            wsData.push([
                '',
                {
                    value: total / 100,
                    format: '€0.00'
                },
                '',
                'Totaal'
            ]);

            // Empty line
            wsData.push([])
        }

        return ExcelHelper.buildWorksheet(wsData, {
            defaultColumnWidth: 13
        })
    }


    static async export(e: StripePayoutExport) {
        const wb = XLSX.utils.book_new();

        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, this.createPayouts(e.includedPayouts, e.payouts), "Uitbetalingen");
        XLSX.utils.book_append_sheet(wb, this.createInvoices(e.includedPayouts, e.payouts), "Facturen");
        XLSX.utils.book_append_sheet(wb, this.createStripeInvoices(e.includedPayouts, e.payouts), "Stripe Facturen");

        return (await XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })) as Buffer;
    }
}
