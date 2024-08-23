import { column, Model, SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { SQL, SQLSelect } from '@stamhoofd/sql';
import { MemberResponsibilityRecord as MemberResponsibilityRecordStruct } from '@stamhoofd/structures';
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

    /**
     * Experimental: needs to move to library
     */
    static select() {
        const transformer = (row: SQLResultNamespacedRow): MemberResponsibilityRecord => {
            const d = (this as typeof MemberResponsibilityRecord & typeof Model).fromRow(row[this.table] as any) as MemberResponsibilityRecord|undefined
    
            if (!d) {
                throw new Error("MemberResponsibilityRecord not found")
            }

            return d;
        }
        
        const select = new SQLSelect(transformer, SQL.wildcard())
        return select.from(SQL.table(this.table))
    }
}
