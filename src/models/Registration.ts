import { column,Model } from '@simonbackx/simple-database';
import { v4 as uuidv4 } from "uuid";

export class Registration extends Model {
    static table = "members"

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

    @column({ type: "string", nullable: true })
    paymentId: string | null = null;

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
}