import { column,ManyToOneRelation,Model } from '@simonbackx/simple-database';
import { v4 as uuidv4 } from "uuid";

import { Payment } from './Payment';

export type RegistrationWithPayment = Registration & { payment: Payment }
export class Registration extends Model {
    static table = "registrations"

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    memberId: string;

    @column({ type: "string" })
    groupId: string;

    @column({ type: "string", foreignKey: Registration.payment })
    paymentId: string

    @column({ type: "integer" })
    cycle: number;

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

    @column({ type: "datetime", nullable: true })
    registeredAt: Date | null = null

    @column({ type: "datetime", nullable: true})
    deactivatedAt: Date | null = null

    static payment = new ManyToOneRelation(Payment, "payment")
}