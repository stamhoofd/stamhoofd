import { CachedBalance, Member, Registration } from '@stamhoofd/models';
import { SQL, SQLAlias, SQLNamedExpression, SQLOrderBy, SQLOrderByDirection, SQLSelectAs, SQLSortDefinitions, SQLSum } from '@stamhoofd/sql';
import { RegistrationWithMemberBlob } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
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
        join: SQL.leftJoin(
            SQL.select('objectId', 'organizationId',
                new SQLSelectAs(
                    new SQLSum(
                        SQL.column('amountOpen'),
                    ),
                    new SQLAlias('outstandingBalance'),
                ))
                .from(CachedBalance.table)
                .groupBy(SQL.column(CachedBalance.table, 'objectId'), SQL.column(CachedBalance.table, 'organizationId')).as('cb') as SQLNamedExpression, 'cb',
        )
            .where(SQL.column('objectId'), SQL.column(Registration.table, 'memberId'))
            .andWhere(SQL.column('organizationId'), SQL.column(Registration.table, 'organizationId')),
        select: [SQL.column('cb', 'outstandingBalance')],
    },
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
