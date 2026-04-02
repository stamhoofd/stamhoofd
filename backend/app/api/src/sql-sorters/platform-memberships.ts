import type { PlainObject } from '@simonbackx/simple-encoding';
import type { SQLOrderByDirection, SQLSortDefinition, SQLSortDefinitions } from '@stamhoofd/sql';
import { SQL, SQLOrderBy } from '@stamhoofd/sql';
import type { PlatformMembership } from '@stamhoofd/structures';

type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never
}[keyof T];

const columnsToFilterOn: (KeysOfType<PlatformMembership, PlainObject | Date>)[] = ['id','startDate','endDate','membershipTypeId', 'price', 'createdAt', 'trialUntil', 'freeAmount'];

export const platformMembershipSorters: SQLSortDefinitions<PlatformMembership> = {
    // WARNING! TEST NEW SORTERS THOROUGHLY!
    // Try to avoid creating sorters on fields that er not 1:1 with the database, that often causes pagination issues if not thought through
    // An example: sorting on 'name' is not a good idea, because it is a concatenation of two fields.
    // You might be tempted to use ORDER BY firstName, lastName, but that will not work as expected and it needs to be ORDER BY CONCAT(firstName, ' ', lastName)
    // Why? Because ORDER BY firstName, lastName produces a different order dan ORDER BY CONCAT(firstName, ' ', lastName) if there are multiple people with spaces in the first name
    // And that again causes issues with pagination because the next query will append a filter of name > 'John Doe' - causing duplicate and/or skipped results
    // What if you need mapping? simply map the sorters in the frontend: name -> firstname, lastname, age -> birthDay, etc.
    ...Object.fromEntries(columnsToFilterOn.map((column: KeysOfType<PlatformMembership, PlainObject | Date>) => [column, createColumnSortDefinition(column)]))
};

/**
 * Create a basic sort definition from a column
 * @param column 
 * @returns 
 */
function createColumnSortDefinition<K extends KeysOfType<PlatformMembership, PlainObject | Date>>(column: K): SQLSortDefinition<PlatformMembership, PlatformMembership[K]>{
    return {
            getValue(a: PlatformMembership) {
                return a[column];
            },
            toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
                return new SQLOrderBy({
                    column: SQL.column(column),
                    direction,
                });
            },
    }
}
