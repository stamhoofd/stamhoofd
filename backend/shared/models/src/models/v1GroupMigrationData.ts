import { column } from '@simonbackx/simple-database';

import { QueryableModel } from '@stamhoofd/sql';

/**
 * Temporary table for the migration from v1 to v2.
 * Keeps track of which combination of group id and cycle has been migrated to a new group.
 */
export class V1GroupMigrationData extends QueryableModel {
    static table = 'v1_groups_migration_data';

    // new group id (can be same as old group id if no new group was created)
    @column({ primary: true, type: 'string' })
    newGroupId: string;

    // old group id from v1
    @column({ type: 'string' })
    oldGroupId: string;

    // old cycle from v1
    @column({ type: 'integer' })
    oldCycle = 0;
}

/**
 * Temporary table for the migration from v1 to v2.
 * Keeps track of which combination of waiting list group id and cycle has been migrated to a new group.
 */
export class V1WaitingListMigrationData extends QueryableModel {
    static table = 'v1_waiting_list_migration_data';

    // new group id (can be same as old group id if no new group was created)
    @column({ primary: true, type: 'string' })
    newGroupId: string;

    // old group id from v1
    @column({ type: 'string' })
    oldGroupId: string;

    // old cycle from v1
    @column({ type: 'integer' })
    oldCycle = 0;
}
