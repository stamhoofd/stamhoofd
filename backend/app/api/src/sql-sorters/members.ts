import type { SQLOrderByDirection, SQLSortDefinitions } from '@stamhoofd/sql';
import { SQL, SQLAlias, SQLIfNull, SQLMin, SQLOrderBy, SQLSelectAs } from '@stamhoofd/sql';
import { Formatter } from '@stamhoofd/utility';

import { Member, Registration } from '@stamhoofd/models';
import type { SQLNamedExpression } from '@stamhoofd/sql';
import type { MemberWithRegistrationsBlob } from '@stamhoofd/structures';
import { createMemberCachedBalanceJoin } from '../helpers/outstandingBalanceJoin.js';

export const memberRegisteredAtJoin = SQL.leftJoin(
    SQL.select('memberId', 'organizationId',
        new SQLSelectAs(
            new SQLMin(
                SQL.column('registeredAt'),
            ),
            new SQLAlias('registeredAt'),
        ),
    )
        .from(Registration.table)
        .whereNot(SQL.column(Registration.table, 'registeredAt'), null)
        .groupBy(SQL.column(Registration.table, 'memberId'), SQL.column(Registration.table, 'organizationId'))
        .as('memberRegisteredAt') as SQLNamedExpression,
    'memberRegisteredAt',
)
    .where(SQL.column('memberId'), SQL.column(Member.table, 'id'))
    .andWhere(SQL.column('organizationId'), SQL.column(Member.table, 'organizationId'));

export const memberCachedBalanceJoin = createMemberCachedBalanceJoin()
    .where(SQL.column('objectId'), SQL.column(Member.table, 'id'))
    .andWhere(SQL.column('organizationId'), SQL.column(Member.table, 'organizationId'));

export const memberSorters: SQLSortDefinitions<MemberWithRegistrationsBlob> = {
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
    'memberNumber': {
        getValue(a) {
            return a.details.memberNumber;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('memberNumber'),
                direction,
            });
        },
    },
    'firstName': {
        getValue(a) {
            return a.firstName;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('firstName'),
                direction,
            });
        },
    },
    'lastName': {
        getValue(a) {
            return a.lastName;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('lastName'),
                direction,
            });
        },
    },
    'birthDay': {
        getValue(a) {
            return a.details.birthDay ? Formatter.dateIso(a.details.birthDay) : null;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('birthDay'),
                direction,
            });
        },
    },
    'createdAt': {
        getValue(a) {
            return a.createdAt;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('createdAt'),
                direction,
            });
        },
    },
    'registeredAt': {
        getValue(a) {
            const registrations = a.registrations;

            if (registrations.length === 0) {
                return null;
            }

            const filtered = registrations.filter(r => r.registeredAt !== null).map(r => r.registeredAt!.getTime());

            if (filtered.length === 0) {
                return null;
            }
            return new Date(Math.min(...filtered));
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: new SQLIfNull(SQL.column('memberRegisteredAt', 'registeredAt'), 0),
                direction,
            });
        },
        join: memberRegisteredAtJoin,
        select: [SQL.column('memberRegisteredAt', 'registeredAt')],
    },
    'memberCachedBalance.toPay': {
        getValue(a) {
            return a.balances.reduce((sum, r) => sum + (r.amountOpen + r.amountPending), 0);
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: new SQLIfNull(SQL.column('memberCachedBalance', 'toPay'), 0),
                direction,
            });
        },
        join: memberCachedBalanceJoin,
        select: [SQL.column('memberCachedBalance', 'toPay')],
    },
};
