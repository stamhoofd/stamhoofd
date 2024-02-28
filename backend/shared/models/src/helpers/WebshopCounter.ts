import { Database } from "@simonbackx/simple-database";
import { QueueHandler } from "@stamhoofd/queues";
import { WebshopNumberingType } from "@stamhoofd/structures";

export class WebshopCounter  {
    static numberCache: Map<string, number> = new Map()

    static async getNextNumber(webshopId: string, numberingType: WebshopNumberingType): Promise<number> {
        if (numberingType == WebshopNumberingType.Random) {
            return Math.floor(Math.random() * 1000000000)
        }
        
        // Prevent race conditions: create a queue
        // The queue can only run one at a time for the same webshop (so multiple webshops at the same time are allowed)
        return await QueueHandler.schedule("webshop/numbers-"+webshopId, async () => {
            if (this.numberCache.has(webshopId)) {
                const nextNumber = this.numberCache.get(webshopId)!
                this.numberCache.set(webshopId, nextNumber + 1)
                return nextNumber
            }

            const [rows] = await Database.select(`select max(number) as previousNumber from webshop_orders where webshopId = ?`, [webshopId]);
            let nextNumber: number | undefined

            if (rows.length == 0) {
                nextNumber = 1
            } else {
                const previousNumber: number | null = rows[0]['']['previousNumber'] as number|null;
                nextNumber = (previousNumber ?? 0) + 1
            }

            this.numberCache.set(webshopId, nextNumber + 1 )
            return nextNumber
        })
    }
}
