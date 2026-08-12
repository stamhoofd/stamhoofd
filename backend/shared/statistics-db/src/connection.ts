import { DatabaseInstance } from '@simonbackx/simple-database';
import { getStatisticsDatabaseConfig, getStatisticsPoolOptions } from './migrations.js';

let connection: DatabaseInstance | undefined;

/**
 * A connection of its own to the platform statistics database.
 *
 * The shared `Database` stays pointed at the main administration, which the sync reads through the
 * models: the statistics database lives on the Metabase server, so the two are not even the same
 * MySQL to point a single connection at.
 */
export function getStatisticsConnection(): DatabaseInstance {
    connection ??= new DatabaseInstance({ ...getStatisticsPoolOptions(), database: getStatisticsDatabaseConfig().DB_DATABASE });
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
