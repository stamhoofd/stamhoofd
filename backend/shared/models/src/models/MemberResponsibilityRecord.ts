import { column, Model } from '@simonbackx/simple-database';
import { v4 as uuidv4 } from "uuid";
import { MemberResponsibilityRecord as MemberResponsibilityRecordStruct } from '@stamhoofd/structures';

export class MemberResponsibilityRecord extends Model {
    static table = "member_responsibility_records"

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string", nullable: true })
    organizationId: string|null = null;

    @column({ type: "string", nullable: true })
    groupId: string|null = null;

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

    getStructure() {
        return MemberResponsibilityRecordStruct.create(this)
    }
}
