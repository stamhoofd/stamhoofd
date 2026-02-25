import { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { SQL, SQLOrderBy, SQLOrderByDirection, SQLSortDefinitions } from '@stamhoofd/sql';
import { Formatter } from '@stamhoofd/utility';
import { organizationJoin } from '../sql-filters/event-notifications.js';

export const eventNotificationsSorters: SQLSortDefinitions<SQLResultNamespacedRow> = {
    // WARNING! TEST NEW SORTERS THOROUGHLY!
    // Try to avoid creating sorters on fields that er not 1:1 with the database, that often causes pagination issues if not thought through
    // An example: sorting on 'name' is not a good idea, because it is a concatenation of two fields.
    // You might be tempted to use ORDER BY firstName, lastName, but that will not work as expected and it needs to be ORDER BY CONCAT(firstName, ' ', lastName)
    // Why? Because ORDER BY firstName, lastName produces a different order dan ORDER BY CONCAT(firstName, ' ', lastName) if there are multiple people with spaces in the first name
    // And that again causes issues with pagination because the next query will append a filter of name > 'John Doe' - causing duplicate and/or skipped results
    // What if you need mapping? simply map the sorters in the frontend: name -> firstname, lastname, age -> birthDay, etc.

    'id': {
        getValue(a) {
            return a['event_notifications'].id;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('id'),
                direction,
            });
        },
    },
    'status': {
        getValue(a) {
            return a['event_notifications'].status;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('status'),
                direction,
            });
        },
    },
    'startDate': {
        getValue(a) {
            return Formatter.dateTimeIso(a['event_notifications'].startDate as Date, 'UTC');
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('startDate'),
                direction,
            });
        },
    },
    'endDate': {
        getValue(a) {
            return Formatter.dateTimeIso(a['event_notifications'].endDate as Date, 'UTC');
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('endDate'),
                direction,
            });
        },
    },
    'submittedAt': {
        getValue(a) {
            return a['event_notifications'].submittedAt !== null ? Formatter.dateTimeIso(a['event_notifications'].submittedAt as Date, 'UTC') : null;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('submittedAt'),
                direction,
            });
        },
    },
    'organization.name': {
        getValue(a) {
            return a.organizations.name;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('organizations', 'name'),
                direction,
            });
        },
        join: organizationJoin,
        select: [SQL.column('organizations', 'name')],
    },
    'organization.uriPadded': {
        getValue(a) {
            return (a.organizations.uri as string).padStart(10, '0');
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.lpad(SQL.column('organizations', 'uri'), 10, '0'),
                direction,
            });
        },
        join: organizationJoin,
        select: [SQL.column('organizations', 'uri')],
    },
};
