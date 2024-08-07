import { ArrayDecoder, AutoEncoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";

export class StockReservation extends AutoEncoder {
    @field({ decoder: StringDecoder, field: 'id' })
    objectId: string;

    /**
     * To identify for what object type this reservation happened.
     * 
     * E.g. 'productPrice'
     */
    @field({ decoder: StringDecoder, field: 't' })
    objectType: string;

    @field({ decoder: IntegerDecoder, field: 'a' })
    amount = 0;

    @field({ decoder: new ArrayDecoder(StockReservation), field: 'c' })
    children: StockReservation[] = [];

    static getAmount(type: string, id: string, list: StockReservation[]) {
        let amount = 0;
        for (const reservation of list) {
            if (reservation.objectType === type && reservation.objectId === id) {
                amount += reservation.amount;
            }
        }
        return amount;
    }

    static filter(type: string, id: string, list: StockReservation[]): StockReservation[] {
        return list.filter(r => r.objectType === type && r.objectId === id).flatMap(r => r.children);
    }

    static add(base: StockReservation[], add: StockReservation) {
        const existingIndex = base.findIndex(r => r.objectType === add.objectType && r.objectId === add.objectId);
        
        if (existingIndex !== -1) {
            const existing = base[existingIndex];
            existing.amount += add.amount
            existing.children = StockReservation.added(existing.children, add.children);

            if (existing.amount == 0 && existing.children.length === 0) {
                // NOTE: the amount should be zero.
                // if it is negative, we still have to keep it, because it can be needed during a calculation
                base.splice(existingIndex, 1);
                return;
            }
        } else {
            base.push(add.clone());
        }
    }

    invert() {
        this.amount = -this.amount;

        for (const child of this.children) {
            child.invert();
        }
    }

    static remove(base: StockReservation[], remove: StockReservation) {
        const c = remove.clone()
        c.invert()
        return this.add(base, c);
    }

    static added(base: StockReservation[], add: StockReservation[]): StockReservation[] {
        const newReservations: StockReservation[] = [];

        for (const r of base) {
            // We do this because it is possible that base contains errors or duplicates
            this.add(newReservations, r);
        }

        for (const r of add) {
            this.add(newReservations, r);
        }

        return newReservations;
    }

    static removed(base: StockReservation[], remove: StockReservation[]): StockReservation[] {
        const newReservations: StockReservation[] = [];

        for (const r of base) {
            // We do this because it is possible that base contains errors or duplicates
            this.add(newReservations, r);
        }

        for (const r of remove) {
            this.remove(newReservations, r);
        }

        return newReservations;
    }
}
