import { column, Model } from '@simonbackx/simple-database';
import { v4 as uuidv4 } from "uuid";

export class MemberResponsibilityRecord extends Model {
    static table = "member_responsibility_records"

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    organizationId: string;

    @column({ type: "string" })
    memberId: string

    @column({ type: "string" })
    responsibilityId: string

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
    startDate: Date

    @column({ type: "datetime", nullable: true })
    endDate: Date | null = null

}
