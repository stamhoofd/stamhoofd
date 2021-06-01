import { column,Database,ManyToOneRelation,Model } from '@simonbackx/simple-database';
import { Payment as PaymentStructure, Registration as RegistrationStructure } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import { Payment } from './Payment';

export type RegistrationWithPayment = Registration & { payment: Payment | null }
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

    @column({ type: "string", nullable: true, foreignKey: Registration.payment })
    paymentId: string | null = null

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

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    @column({ type: "datetime", nullable: true })
    registeredAt: Date | null = null

    @column({ type: "datetime", nullable: true })
    reservedUntil: Date | null = null

    @column({ type: "boolean" })
    waitingList = false

    /**
     * When a registration is on the waiting list or is invite only, set this to true to allow the user to
     * register normally.
     */
    @column({ type: "boolean" })
    canRegister = false

    @column({ type: "datetime", nullable: true})
    deactivatedAt: Date | null = null

    static payment = new ManyToOneRelation(Payment, "payment")

    getStructure(this: RegistrationWithPayment) {
        return RegistrationStructure.create(
            Object.assign(Object.assign({}, this), {
                payment: this.payment ? PaymentStructure.create(this.payment) : null
            })
        )
    }

    /**
     * Get the number of active members that are currently registered
     * This is used for billing
     */
    static async getActiveMembers(organizationId: string): Promise<number> {
        const query = `
        SELECT COUNT(DISTINCT \`${Registration.table}\`.memberId) as c FROM \`${Registration.table}\` 
        JOIN \`groups\` ON \`groups\`.id = \`${Registration.table}\`.groupId
        WHERE \`groups\`.organizationId = ? AND \`${Registration.table}\`.cycle = \`groups\`.cycle AND \`${Registration.table}\`.registeredAt is not null AND \`${Registration.table}\`.waitingList = 0`
        
        const [results] = await Database.select(query, [organizationId])
        const count = results[0]['']['c'];

        if (Number.isInteger(count)) {
           return count
        } else {
            console.error("Unexpected result for occupancy", results)
            throw new Error("Query failed")
        }
    }
}