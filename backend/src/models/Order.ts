import { column, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { OrderData } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import { Payment } from './Payment';
import { Webshop } from './Webshop';
import { WebshopCounter } from './WebshopCounter';


export class Order extends Model {
    static table = "webshop_orders";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ foreignKey: Order.webshop, type: "string" })
    webshopId: string;

    @column({ type: "string", nullable: true, foreignKey: Order.payment })
    paymentId: string | null = null
    
    @column({ type: "json", decoder: OrderData })
    data: OrderData

    @column({ type: "integer", nullable: true })
    number: number | null = null

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    updatedAt: Date

    @column({ type: "datetime", nullable: true })
    validAt: Date | null = null

    static webshop = new ManyToOneRelation(Webshop, "webshop");
    static payment = new ManyToOneRelation(Payment, "payment")

    async markValid() {
        this.validAt = new Date() // will get flattened AFTER calculations
        this.validAt.setMilliseconds(0)
        this.number = await WebshopCounter.getNextNumber(this.webshopId)
    }


}
