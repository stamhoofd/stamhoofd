import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { MemberDetails } from '@stamhoofd/structures';
import { Member } from './index.js';

export class MergedMember extends QueryableModel {
    static override table = 'merged_members';

    // #region Member columns
    @column({
        primary: true,
        type: 'string',
    })
    id: string = '';

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    @column({
        type: 'string',
    })
    firstName: string;

    @column({
        type: 'string',
    })
    lastName: string;

    @column({
        type: 'string',
        nullable: true,
    })
    birthDay: string | null;

    @column({
        type: 'string',
        nullable: true,
    })
    memberNumber: string | null;

    @column({ type: 'json', decoder: MemberDetails })
    details: MemberDetails;

    /**
     * @deprecated
     */
    @column({ type: 'integer' })
    outstandingBalance = 0;

    @column({
        type: 'datetime',
        beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime',
        beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;
    // #endregion

    // #region extra columns
    @column({
        type: 'string',
        nullable: false,
    })
    mergedToId: string = '';

    @column({
        type: 'datetime',
        beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    mergedAt: Date;
    // #endregion

    static fromMember(member: Member, mergedToId: string): MergedMember {
        const mergedMember = new MergedMember();
        mergedMember.mergedToId = mergedToId;
        mergedMember.mergedAt = new Date();

        mergedMember.id = member.id;
        mergedMember.organizationId = member.organizationId;
        mergedMember.firstName = member.firstName;
        mergedMember.lastName = member.lastName;
        mergedMember.birthDay = member.birthDay;
        mergedMember.memberNumber = member.memberNumber;
        mergedMember.outstandingBalance = member.outstandingBalance;
        mergedMember.createdAt = new Date(member.createdAt);
        mergedMember.updatedAt = new Date(member.updatedAt);
        mergedMember.details = member.details.clone();
        return mergedMember;
    }
}
