import { QueueHandler } from '@stamhoofd/queues';

import type { OrganizationInvoiceSettings } from '@stamhoofd/structures/OrganizationInvoiceSettings.js';
import { Formatter } from '@stamhoofd/utility';
import type { DateTime } from 'luxon';
import { Invoice } from '../models/Invoice.js';

export class InvoiceCounter {
    static numberCache: Map<string, {lastNumber: number, date: Date}> = new Map();


    private static getNextResetDate(last: DateTime, resetMonth: number): DateTime {
        const candidate = last.set({ month: resetMonth, day: 1 }).startOf('day');
        return candidate > last ? candidate : candidate.plus({ years: 1 }).startOf('day');
    }

    static shouldStartNewSeries(settings: OrganizationInvoiceSettings, lastInvoiceDate: Date, invoiceDate: Date) {
        if (settings.resetMonth === null) {
            return false;
        }

        const last = Formatter.luxon(lastInvoiceDate);
        const current = Formatter.luxon(invoiceDate);

        return current >= this.getNextResetDate(last, settings.resetMonth)
    }

    /**
     * XXX-123 -> 123
     * YYY-0001 -> 1
     * 
     * if prefix is enabled:
     * 2025001 -> 1
     * STA-2025001 -> 1
     */
    static parseNumber(settings: OrganizationInvoiceSettings, str: string) {
        str = str.replace(/\D+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
        // Remove prefixes and possibly year
        const splitted = str.split('-');

        let last = splitted[splitted.length - 1];

        const stripYear = settings.prefixYear

        if (last.length) {
            if (stripYear) {
                if (last.length <= 4) {
                    console.error('Could not parse invoice number from string ' + str + ' (could not trim year prefix)')
                    return null;
                }
                last = last.substring(4)
            }

            const int = parseInt(last);
            if (int !== 0 && !isNaN(int) && isFinite(int)) {
                return int;
            }
        }

        console.error('Could not parse invoice number from string ' + str)
        return null;
    }

    static formatNumber(settings: OrganizationInvoiceSettings, int: number, invoicedAt: Date) {
        let str = int.toFixed(0).padStart(settings.padZeroLength, '0')

        if (settings.prefixYear) {
            const year = Formatter.luxon(invoicedAt).year
            str = year + str;
        }

        if (settings.fixedPrefix) {
            if (!settings.fixedPrefix.match(/\D$/)) {
                // Need seperation character
                str = settings.fixedPrefix.replace(/-$/, '') + '-' + str;
            } else {
                str = settings.fixedPrefix +  str;
            }
        }

        return str;
    }

    static async assignNextNumber(invoice: Invoice, settings: OrganizationInvoiceSettings): Promise<void> {
        const organizationId = invoice.organizationId
        return await QueueHandler.schedule('invoice/numbers-' + organizationId, async () => {
            // Invoice date should be inside the queue to ensure it is chronologically generated
            const invoicedAt = new Date();

            const c = this.numberCache.get(organizationId);
            if (c !== undefined) {
                const lastNumber = c.lastNumber

                // check date
                if (!this.shouldStartNewSeries(settings, c.date, invoicedAt)) {
                    // Set and save.
                    // we do this here because it assures we'll not increase the next number if the save fails
                    invoice.number = this.formatNumber(settings, lastNumber + 1, invoicedAt);
                    invoice.invoicedAt = invoicedAt;
                    await invoice.save()

                    // If save succeeds, increase cache:
                    this.numberCache.set(organizationId, {
                        lastNumber: lastNumber + 1,
                        date: new Date(invoicedAt)
                    });
                    return
                }
            }

            const lastInvoice = await Invoice.select()
                    .where('organizationId', organizationId)
                    .where('number', '!=', null)
                    .where('invoicedAt', '!=', null)
                    .orderBy('invoicedAt', 'DESC')
                    .first(false);

            if (lastInvoice && lastInvoice.number && lastInvoice.invoicedAt) {
                // check date
                if (!this.shouldStartNewSeries(settings, lastInvoice.invoicedAt, invoicedAt)) {
                    const lastNumber = this.parseNumber(settings, lastInvoice.number)

                    if (lastNumber) {
                        invoice.number = this.formatNumber(settings, lastNumber + 1, invoicedAt);
                        invoice.invoicedAt = invoicedAt;
                        await invoice.save()
                        
                        this.numberCache.set(organizationId, {
                            lastNumber: lastNumber + 1,
                            date: new Date(invoicedAt)
                        });
                        return;
                    }
                }
            }

            // Start new
            invoice.number = this.formatNumber(settings, 1, invoicedAt);
            invoice.invoicedAt = invoicedAt;
            await invoice.save()
            
            this.numberCache.set(organizationId, {
                lastNumber: 1,
                date: new Date(invoicedAt)
            });
            return;
        });
    }

    static async resetNumbers(organizationId: string): Promise<void> {
        // Prevent race conditions: create a queue
        // The queue can only run one at a time for the same webshop (so multiple webshops at the same time are allowed)
        return await QueueHandler.schedule('invoice/numbers-' + organizationId, async () => {
            this.numberCache.delete(organizationId);
            return Promise.resolve();
        });
    }

    static clearAll() {
        this.numberCache.clear();
    }
}
