import { Member, Registration } from '@stamhoofd/models';
import { baseSQLFilterCompilers, createJoinedRelationFilter, SQL, SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseRegistrationFilterCompilers } from './base-registration-filter-compilers';
import { memberFilterCompilers } from './members';

export const memberJoin = SQL.join(Member.table).where(SQL.column(Member.table, 'id'), SQL.column(Registration.table, 'memberId'));

export const registrationFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    ...baseRegistrationFilterCompilers,
    member: createJoinedRelationFilter(
        memberJoin,
        memberFilterCompilers,
    ),
};
