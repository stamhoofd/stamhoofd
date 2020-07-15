import { column,Model } from '@simonbackx/simple-database';
import { PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

export class Payment extends Model {
    static table = "payments"

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    method: PaymentMethod;

    @column({ type: "string" })
    status: PaymentStatus;

    @column({ type: "integer" })
    price: number;

    @column({ type: "string", nullable: true })
    transferDescription: string | null = null;

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
    paidAt: Date | null = null
}