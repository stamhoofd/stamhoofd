import type { CellValue } from '@stamhoofd/excel-writer';
import { ArchiverWriterAdapter, XlsxBuiltInNumberFormat, XlsxWriter } from '@stamhoofd/excel-writer';
import { Sorter } from '@stamhoofd/utility';
import { Writable } from 'node:stream';

import type { StripePayoutBreakdownData, StripePayoutData, StripePayoutExportData, StripePayoutItemData } from './StripePayoutExportData.js';
import { StripePayoutItemType } from './StripePayoutExportData.js';

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

export class StripePayoutExportExcel {
    /**
     * List of all items for every payout
     */
    private static async writePayouts(writer: XlsxWriter, sheet: symbol, includedPayouts: StripePayoutBreakdownData[]) {
        await writer.addRow(sheet, [
            textCell('Datum', 13),
            textCell('Uitbetaald bedrag', 16),
            textCell('Naam', 45),
            textCell('Bedrag', 13),
            textCell('Beschrijving', 60),
        ]);

        for (const breakdown of [...includedPayouts].sort((b, a) => Sorter.byDateValue(a.payout.arrivalDate, b.payout.arrivalDate))) {
            for (const [index, item] of [...breakdown.items].sort((a, b) => Sorter.byStringValue(a.name, b.name)).entries()) {
                await writer.addRow(sheet, [
                    index > 0 ? empty : dateCell(breakdown.payout.arrivalDate),
                    index > 0 ? empty : currencyCell(breakdown.payout.amount),
                    textCell(item.name),
                    currencyCell(item.amount),
                    textCell(item.description),
                ]);
            }

            // Include total line
            const total = breakdown.items.reduce((total, item) => total + item.amount, 0);
            await writer.addRow(sheet, [
                empty,
                empty,
                textCell('Totaal'),
                currencyCell(total),
                textCell(total === breakdown.payout.amount ? '✓' : 'Klopt niet!'),
            ]);

            // Empty line
            await writer.addRow(sheet, []);
        }
    }

    /**
     * Group by account + month (= payment reference): shows the connected payments and invoices
     */
    private static async writeInvoices(writer: XlsxWriter, sheet: symbol, includedPayouts: StripePayoutBreakdownData[], allPayouts: StripePayoutBreakdownData[]) {
        await writer.addRow(sheet, [
            textCell('Referentie', 22),
            textCell('Factuur', 35),
            textCell('Factuurdatum', 14),
            textCell('Factuurbedrag (incl. BTW)', 22),
            textCell('Aangerekend bedrag', 18),
            textCell('Uitbetalingsdatum', 16),
            textCell('Uitbetaald bedrag', 16),
            textCell('Opmerking', 25),
            textCell('Klant', 30),
            textCell('Ondernemingsnummer', 20),
            textCell('BTW-nummer', 16),
            textCell('Adres', 40),
        ]);

        // Group all data by account + reference
        const groups = new Map<string, {
            item: StripePayoutItemData;
            items: { item: StripePayoutItemData; payout: StripePayoutData }[];
        }>();

        for (const breakdown of allPayouts) {
            for (const item of breakdown.items) {
                if (item.type !== StripePayoutItemType.Invoice) {
                    continue;
                }

                const key = (item.accountId ?? '') + '-' + (item.reference ?? '');
                const group = groups.get(key) ?? {
                    item,
                    items: [],
                };
                group.items.push({
                    item,
                    payout: breakdown.payout,
                });
                groups.set(key, group);
            }
        }

        const sortedGroups = [...groups.values()].sort((a, b) => Sorter.stack(
            Sorter.byStringValue(a.item.reference ?? '', b.item.reference ?? ''),
            Sorter.byStringValue(a.item.description, b.item.description),
        ));

        for (const group of sortedGroups) {
            // Skip groups that don't have any payout in the requested period
            if (!group.items.some(({ payout }) => includedPayouts.some(p => p.payout.id === payout.id))) {
                continue;
            }

            const item = group.item;
            const invoices = item.invoices;
            const customer = invoices[0]?.customer ?? item.payments[0]?.customer ?? null;

            const invoiceTotal = invoices.reduce((total, invoice) => total + invoice.totalWithVAT, 0);
            const invoiceDate = invoices[0]?.invoicedAt ?? null;

            for (const [index, { item: payoutItem, payout }] of [...group.items].sort((b, a) => Sorter.byDateValue(a.payout.arrivalDate, b.payout.arrivalDate)).entries()) {
                await writer.addRow(sheet, [
                    index > 0 ? empty : textCell(item.reference ?? ''),
                    index > 0 ? empty : textCell(item.name),
                    index > 0 ? empty : dateCell(invoiceDate),
                    index > 0 ? empty : (invoices.length === 0 ? empty : currencyCell(invoiceTotal)),
                    index > 0 ? empty : (item.payments.length === 0 ? empty : currencyCell(item.paymentsTotal)),
                    dateCell(payout.arrivalDate),
                    currencyCell(payoutItem.amount),
                    empty,
                    index > 0 ? empty : textCell(customer?.dynamicName ?? item.description),
                    index > 0 ? empty : textCell(customer?.company?.companyNumber ?? '/'),
                    index > 0 ? empty : textCell(customer?.company?.VATNumber ?? '/'),
                    index > 0 ? empty : textCell(customer?.company?.address ? customer.company.address + '' : '/'),
                ]);
            }

            // Include total line
            const total = group.items.reduce((total, { item }) => total + item.amount, 0);
            let remark = 'Nog geen betaling aangemaakt';
            if (item.payments.length > 0) {
                if (total !== item.paymentsTotal) {
                    remark = 'Nog onvolledig';
                } else if (item.hasUninvoicedPayments || invoices.length === 0) {
                    remark = 'Nog niet gefactureerd';
                } else {
                    remark = '✓';
                }
            }

            await writer.addRow(sheet, [
                empty,
                empty,
                empty,
                empty,
                empty,
                textCell('Totaal'),
                currencyCell(total),
                textCell(remark),
            ]);

            // Empty line
            await writer.addRow(sheet, []);
        }
    }

    /**
     * Group Stripe fees by month
     */
    private static async writeStripeInvoices(writer: XlsxWriter, sheet: symbol, includedPayouts: StripePayoutBreakdownData[], allPayouts: StripePayoutBreakdownData[]) {
        await writer.addRow(sheet, [
            textCell('Periode', 25),
            textCell('Afgehouden bedrag', 18),
            textCell('Uitbetalingsdatum', 16),
            textCell('Beschrijving', 25),
        ]);

        // Group all data by Stripe invoice period
        const groupedInvoices = new Map<string, { item: StripePayoutItemData; payout: StripePayoutData }[]>();

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
                    payout: breakdown.payout,
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
                await writer.addRow(sheet, [
                    index > 0 ? empty : textCell(period),
                    currencyCell(-item.item.amount),
                    dateCell(item.payout.arrivalDate),
                    empty,
                ]);
            }

            // Include total line
            const total = -group.reduce((total, item) => total + item.item.amount, 0);
            await writer.addRow(sheet, [
                empty,
                currencyCell(total),
                empty,
                textCell('Totaal'),
            ]);

            // Empty line
            await writer.addRow(sheet, []);
        }
    }

    static async export(e: StripePayoutExportData): Promise<Buffer> {
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

        const payoutsSheet = await writer.addSheet('Uitbetalingen');
        const invoicesSheet = await writer.addSheet('Facturen');
        const stripeInvoicesSheet = await writer.addSheet('Stripe Facturen');
        await writer.ready();

        try {
            await this.writePayouts(writer, payoutsSheet, e.includedPayouts);
            await this.writeInvoices(writer, invoicesSheet, e.includedPayouts, e.payouts);
            await this.writeStripeInvoices(writer, stripeInvoicesSheet, e.includedPayouts, e.payouts);
            await writer.close();
        } catch (error) {
            await writer.abort();
            throw error;
        }

        await finishPromise;
        return Buffer.concat(chunks);
    }
}
