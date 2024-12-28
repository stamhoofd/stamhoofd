import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { Group as GroupStruct, MemberResponsibilityRecordBase, MemberResponsibilityRecord as MemberResponsibilityRecordStruct } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

export class MemberResponsibilityRecord extends QueryableModel {
    static table = 'member_responsibility_records';

    // Columns
    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    @column({ type: 'string', nullable: true })
    groupId: string | null = null;

    @column({ type: 'string' })
    memberId: string;

    @column({ type: 'string' })
    responsibilityId: string;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    startDate: Date;

    @column({ type: 'datetime', nullable: true })
    endDate: Date | null = null;

    getBaseStructure() {
        return MemberResponsibilityRecordBase.create({
            ...this,
        });
    }

    getStructure(group: GroupStruct | null) {
        return MemberResponsibilityRecordStruct.create({
            ...this,
            group,
        });
    }
}
