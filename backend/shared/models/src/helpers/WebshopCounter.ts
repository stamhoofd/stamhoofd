import { Database } from '@simonbackx/simple-database';
import { QueueHandler } from '@stamhoofd/queues';
import { WebshopNumberingType } from '@stamhoofd/structures';

import { Webshop } from '../models/index.js';

export class WebshopCounter {
    static numberCache: Map<string, number> = new Map();

    static async getNextNumber(webshop: Webshop): Promise<number> {
        if (webshop.privateMeta.numberingType == WebshopNumberingType.Random) {
            return Math.floor(Math.random() * 1000000000) + 100000000;
        }
        const webshopId = webshop.id;

        // For sequential numbering, we cannot go over 100000000
        const maxStartNumber = 100000000 - 100000;

        // Prevent race conditions: create a queue
        // The queue can only run one at a time for the same webshop (so multiple webshops at the same time are allowed)
        return await QueueHandler.schedule('webshop/numbers-' + webshopId, async () => {
            if (this.numberCache.has(webshopId)) {
                const nextNumber = this.numberCache.get(webshopId)!;
                this.numberCache.set(webshopId, nextNumber + 1);
                return nextNumber;
            }

            const [rows] = await Database.select(`select max(number) as previousNumber from webshop_orders where webshopId = ? AND number < 100000000`, [webshopId]);
            let nextNumber: number | undefined;

            if (rows.length === 0) {
                nextNumber = Math.min(maxStartNumber, webshop.privateMeta.startNumber ?? 1);
            }
            else {
                const previousNumber: number | null = rows[0]['']['previousNumber'] as number | null;
                nextNumber = (previousNumber ?? (Math.min(maxStartNumber, webshop.privateMeta.startNumber ?? 1) - 1)) + 1;
            }

            this.numberCache.set(webshopId, nextNumber + 1);
            return nextNumber;
        });
    }

    static async resetNumbers(webshopId: string): Promise<void> {
        // Prevent race conditions: create a queue
        // The queue can only run one at a time for the same webshop (so multiple webshops at the same time are allowed)
        return await QueueHandler.schedule('webshop/numbers-' + webshopId, async () => {
            this.numberCache.delete(webshopId);
            return Promise.resolve();
        });
    }

    static clearAll() {
        this.numberCache.clear();
    }
}
