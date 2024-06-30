import { column, Model } from '@simonbackx/simple-database';
import { RegistrationPeriodSettings, RegistrationPeriod as RegistrationPeriodStruct } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

export class RegistrationPeriod extends Model {
    static table = "registration_periods";

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string", nullable: true })
    organizationId: string | null = null;

    @column({ type: "datetime" })
    startDate: Date

    @column({ type: "datetime" })
    endDate: Date
  
    @column({ type: "json", decoder: RegistrationPeriodSettings })
    settings: RegistrationPeriodSettings;

    @column({ type: "boolean" })
    locked = false

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

    getStructure() {
        return RegistrationPeriodStruct.create(this)
    }
}
