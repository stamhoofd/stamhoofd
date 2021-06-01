import { Database } from "@simonbackx/simple-database";

export class WebshopCounter  {
    static numberCache: Map<string, { nextNumber: number; lastSync: Date; guardPromise?: Promise<any> }> = new Map()

    static async getNextNumber(webshopId: string): Promise<number> {
        if (this.numberCache.has(webshopId)) {
            let n = this.numberCache.get(webshopId)!
            if (n.guardPromise) {
                await n.guardPromise
                n = this.numberCache.get(webshopId)!
            }
            this.numberCache.set(webshopId, { nextNumber: n.nextNumber + 1, lastSync: n.lastSync })
            return n.nextNumber
        }

        // WARNING: we have a race condition if multiple endoints get to this point at the same time (since select is async)
        // They will get a next number, which will be the same, because the didn't create the order yet with the number they received
        // To protect against this, we keep the promise for this result

        const guardPromise = (async () => {
            // Todo: we lost the ability to reset order numbers
            const [rows] = await Database.select(`select max(number) as previousNumber from webshop_orders where webshopId = ?`, [webshopId]);
            let nextNumber: number | undefined

            if (rows.length == 0) {
                nextNumber = 1
            } else {
                const previousNumber: number | null = rows[0]['']['previousNumber'];
                nextNumber = (previousNumber ?? 0)+ 1
            }

            this.numberCache.set(webshopId, { nextNumber: nextNumber+1, lastSync: new Date()})
            return nextNumber
        })();

        // Keep promise
        this.numberCache.set(webshopId, { nextNumber: 0, lastSync: new Date(), guardPromise })
        return await guardPromise
    }
}
