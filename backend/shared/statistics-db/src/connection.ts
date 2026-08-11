import { DatabaseInstance } from '@simonbackx/simple-database';
import { getStatisticsDatabase } from './migrations.js';

let connection: DatabaseInstance | undefined;

/**
 * A connection of its own to the platform statistics database.
 *
 * The shared `Database` stays pointed at the main database: the sync runs inside the API process,
 * next to request handling, so the trick the migrations use (repointing the shared connection) would
 * pull every concurrent query along with it.
 */
export function getStatisticsConnection(): DatabaseInstance {
    connection ??= new DatabaseInstance({ database: getStatisticsDatabase() });
    return connection;
}

export async function endStatisticsConnection(): Promise<void> {
    if (!connection) {
        return;
    }

    const ending = connection;
    connection = undefined;
    await ending.end();
}
