import { column, Model } from '@simonbackx/simple-database';
import { Group as GroupStruct, OrganizationRegistrationPeriodSettings, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";
import { Group, RegistrationPeriod } from '.';

export class OrganizationRegistrationPeriod extends Model {
    static table = "organization_registration_periods";

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string", nullable: true })
    organizationId: string | null = null;

    @column({ type: "string" })
    periodId: string

    @column({ type: "json", decoder: OrganizationRegistrationPeriodSettings })
    settings = OrganizationRegistrationPeriodSettings.create({})

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

    getStructure(this: OrganizationRegistrationPeriod, period: RegistrationPeriod, groups: Group[]) {
        return OrganizationRegistrationPeriodStruct.create({
            ...this,
            period: period.getStructure(),
            groups: groups.map(g => g.getStructure()).sort(GroupStruct.defaultSort)
        })
    }
}
