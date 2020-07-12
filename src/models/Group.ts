import { column,Model } from '@simonbackx/simple-database';
import { GroupSettings } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

export class Group extends Model {
    static table = "groups";

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "json", decoder: GroupSettings })
    settings: GroupSettings;

    @column({ type: "string" })
    organizationId: string;

    /**
     * Every time a new registration period starts, this number increases. This is used to mark all older registrations as 'out of date' automatically
     */
    @column({ type: "integer" })
    cycle = 0;

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
}