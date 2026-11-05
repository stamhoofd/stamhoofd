import type { MemberWithUsersRegistrationsAndGroups } from '@stamhoofd/models';
import type { SQLOrderByDirection, SQLSortDefinition, SQLSortDefinitions } from '@stamhoofd/sql';
import { SQL, SQLAlias, SQLIfNull, SQLOrderBy, SQLSelectAs } from '@stamhoofd/sql';
import { Formatter } from '@stamhoofd/utility';
import { memberCachedBalanceJoinForOrganization } from '../helpers/outstandingBalanceJoin.js';
import { throwIfNoFinancialReadAccess } from '../sql-filters/members.js';
import { judicialRecordStatusExpression } from '../helpers/judicialRecordStatus.js';

export const memberSorters = (organizationId: string | null = null, { judicialRecordMinimumAges }: { judicialRecordMinimumAges?: Map<string, number> } = {}): SQLSortDefinitions<MemberWithUsersRegistrationsAndGroups> => {
    const sorters: SQLSortDefinitions<MemberWithUsersRegistrationsAndGroups> = new Map<string, SQLSortDefinition<MemberWithUsersRegistrationsAndGroups>>([
        // WARNING! TEST NEW SORTERS THOROUGHLY!
        // Try to avoid creating sorters on fields that er not 1:1 with the database, that often causes pagination issues if not thought through
        // An example: sorting on 'name' is not a good idea, because it is a concatenation of two fields.
        // You might be tempted to use ORDER BY firstName, lastName, but that will not work as expected and it needs to be ORDER BY CONCAT(firstName, ' ', lastName)
        // Why? Because ORDER BY firstName, lastName produces a different order dan ORDER BY CONCAT(firstName, ' ', lastName) if there are multiple people with spaces in the first name
        // And that again causes issues with pagination because the next query will append a filter of name > 'John Doe' - causing duplicate and/or skipped results
        // What if you need mapping? simply map the sorters in the frontend: name -> firstname, lastname, age -> birthDay, etc.
        ['id', {
            getValue(a) {
                return a.id;
            },
            toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
                return new SQLOrderBy({
                    column: SQL.column('id'),
                    direction,
                });
            },
        }],
        ['memberNumber', {
            getValue(a) {
                return a.memberNumber;
            },
            toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
                return new SQLOrderBy({
                    column: SQL.column('memberNumber'),
                    direction,
                });
            },
        }],
        ['firstName', {
            getValue(a) {
                return a.firstName;
            },
            toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
                return new SQLOrderBy({
                    column: SQL.column('firstName'),
                    direction,
                });
            },
        }],
        ['lastName', {
            getValue(a) {
                return a.lastName;
            },
            toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
                return new SQLOrderBy({
                    column: SQL.column('lastName'),
                    direction,
                });
            },
        }],
        ['birthDay', {
            getValue(a) {
                return a.details.birthDay ? Formatter.dateIso(a.details.birthDay) : null;
            },
            toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
                return new SQLOrderBy({
                    column: SQL.column('birthDay'),
                    direction,
                });
            },
        }],
        ['createdAt', {
            getValue(a) {
                return Formatter.dateTimeIso(a.createdAt, 'UTC');
            },
            toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
                return new SQLOrderBy({
                    column: SQL.column('createdAt'),
                    direction,
                });
            },
        }],
        ['lastRegisteredAt', {
            getValue(a) {
                return a.lastRegisteredAt ? Formatter.dateTimeIso(a.lastRegisteredAt, 'UTC') : null;
            },
            toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
                return new SQLOrderBy({
                    column: SQL.column('lastRegisteredAt'),
                    direction,
                });
            },
        }],
    ]);

    if (judicialRecordMinimumAges?.size) {
        // The status is derived from the member's responsibilities, so it is selected along with the member to keep
        // getValue (and with it the page filter) identical to what the database ordered on.
        const expression = judicialRecordStatusExpression(judicialRecordMinimumAges);

        sorters.set('judicialRecordStatus', {
            getValue(a) {
                const row = a.rawSelectedRow?.['data'];
                if (!row || !('judicialRecordStatus' in row)) {
                    throw new Error('judicialRecordStatus was not selected when selecting this member');
                }
                return row['judicialRecordStatus'] as string;
            },
            toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
                return new SQLOrderBy({
                    column: expression,
                    direction,
                });
            },
            select: [new SQLSelectAs(expression, new SQLAlias('data__judicialRecordStatus'))],
        });
    }

    if (organizationId) {
        sorters.set('memberCachedBalance.amountOpen', {
            getValue(a) {
                const row = a.rawSelectedRow?.['memberCachedBalance'];
                if (!row) {
                    throw new Error('memberCachedBalance was not joined when selecting this member');
                }
                return (row['amountOpen'] as number | null) ?? 0;
            },
            toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
                return new SQLOrderBy({
                    column: new SQLIfNull(SQL.column('memberCachedBalance', 'amountOpen'), 0),
                    direction,
                });
            },
            join: memberCachedBalanceJoinForOrganization(organizationId),
            select: [SQL.column('memberCachedBalance', 'amountOpen')],
            checkPermission: throwIfNoFinancialReadAccess,
        });
    }

    return sorters;
};
