import { Database, DatabaseInstance, Migration } from '@simonbackx/simple-database';
import path from 'node:path';
import { getStatisticsDatabaseConfig, getStatisticsPoolOptions } from './database.js';

export function getStatisticsMigrationsPath(): string {
    return path.join(import.meta.dirname, 'migrations');
}

/**
 * Run the migrations of the platform statistics database.
 *
 * That database keeps its own migration history, in its own `migrations` table, so it can be moved
 * to another server without dragging the main database along. `Migration.runAll` always applies and
 * records against the connection it finds, so the shared connection is pointed at the statistics
 * database for the duration and restored afterwards.
 */
export async function runStatisticsMigrations(): Promise<void> {
    const database = getStatisticsDatabaseConfig().DB_DATABASE;
    const options = getStatisticsPoolOptions();
    const globalDatabase = new DatabaseInstance({ ...options, database: null });

    try {
        await globalDatabase.statement(`CREATE DATABASE IF NOT EXISTS ${globalDatabase.escapeId(database)} DEFAULT CHARACTER SET = \`utf8mb4\` DEFAULT COLLATE = \`utf8mb4_0900_ai_ci\``);
    }
    finally {
        await globalDatabase.end();
    }

    await Database.reload({ ...options, database });

    try {
        if (!await Migration.runAll(getStatisticsMigrationsPath())) {
            throw new Error('Platform statistics migrations failed');
        }
    }
    finally {
        // Empty options put the shared connection back on the main database, which the process holds
        // in its environment.
        await Database.reload({});
    }
}
