import { Member } from '@stamhoofd/models';
import { SQL, SQLOrderBy, SQLOrderByDirection, SQLSortDefinitions } from '@stamhoofd/sql';
import { MemberWithRegistrationsBlob, RegistrationWithMemberBlob } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { outstandingBalanceJoin } from '../helpers/outstandingBalanceJoin.js';
import { memberJoin } from '../sql-filters/registrations.js';

export const registrationSorters: SQLSortDefinitions<RegistrationWithMemberBlob> = {
    // WARNING! TEST NEW SORTERS THOROUGHLY!
    // Try to avoid creating sorters on fields that er not 1:1 with the database, that often causes pagination issues if not thought through
    // An example: sorting on 'name' is not a good idea, because it is a concatenation of two fields.
    // You might be tempted to use ORDER BY firstName, lastName, but that will not work as expected and it needs to be ORDER BY CONCAT(firstName, ' ', lastName)
    // Why? Because ORDER BY firstName, lastName produces a different order dan ORDER BY CONCAT(firstName, ' ', lastName) if there are multiple people with spaces in the first name
    // And that again causes issues with pagination because the next query will append a filter of name > 'John Doe' - causing duplicate and/or skipped results
    // What if you need mapping? simply map the sorters in the frontend: name -> firstname, lastname, age -> birthDay, etc.

    'id': {
        getValue(a) {
            return a.id;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('id'),
                direction,
            });
        },
    },
    'registeredAt': {
        getValue(a) {
            return a.registeredAt;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('registeredAt'),
                direction,
            });
        },
    },
    'cachedOutstandingBalanceForMember.value': {
        getValue(a) {
            return a.member.balances.reduce((sum, r) => sum + (r.amountOpen), 0);
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('cb', 'outstandingBalance'),
                direction,
            });
        },
        join: outstandingBalanceJoin,
        select: [SQL.column('cb', 'outstandingBalance')],
    },
    'member.memberNumber': createMemberColumnSorter({
        columnName: 'memberNumber',
        getValue: member => member.details.memberNumber ?? '',

    }),
    'member.firstName': {
        getValue(a) {
            return a.member.firstName;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column(Member.table, 'firstName'),
                direction,
            });
        },
        join: memberJoin,
        select: [SQL.column(Member.table, 'firstName')],
    },
    'member.lastName': {
        getValue(a) {
            return a.member.lastName;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column(Member.table, 'lastName'),
                direction,
            });
        },
        join: memberJoin,
        select: [SQL.column(Member.table, 'lastName')],
    },
    'member.birthDay': {
        getValue(a) {
            return a.member.details.birthDay === null ? null : Formatter.dateIso(a.member.details.birthDay);
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column(Member.table, 'birthDay'),
                direction,
            });
        },
        join: memberJoin,
        select: [SQL.column(Member.table, 'birthDay')],
    },
};

/**
 * Helper function for simple sort on member column
 * @param param0
 * @returns
 */
function createMemberColumnSorter<T>({ columnName, getValue }: { columnName: string; getValue: (member: MemberWithRegistrationsBlob) => T }) {
    return {
        getValue: (registration: RegistrationWithMemberBlob) => getValue(registration.member),
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column(Member.table, columnName),
                direction,
            });
        },
        join: memberJoin,
        select: [SQL.column(Member.table, columnName)],
    };
}
