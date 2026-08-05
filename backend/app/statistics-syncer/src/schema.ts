import { DatabaseInstance, Migration } from '@simonbackx/simple-database';
import path from 'node:path';
import { getStatisticsConnection, getStatisticsDatabaseConfig, getStatisticsPoolOptions } from './database.js';

export function getStatisticsMigrationsPath(): string {
    return path.join(import.meta.dirname, 'migrations');
}

/**
 * Run the migrations of the platform statistics database.
 *
 * That database keeps its own migration history, in its own `migrations` table, so it can be moved
 * to another server without dragging the main database along.
 */
export async function runStatisticsMigrations(): Promise<void> {
    const database = getStatisticsDatabaseConfig().DB_DATABASE;
    const globalDatabase = new DatabaseInstance({ ...getStatisticsPoolOptions(), database: null });

    try {
        await globalDatabase.statement(`CREATE DATABASE IF NOT EXISTS ${globalDatabase.escapeId(database)} DEFAULT CHARACTER SET = \`utf8mb4\` DEFAULT COLLATE = \`utf8mb4_0900_ai_ci\``);
    }
    finally {
        await globalDatabase.end();
    }

    if (!await Migration.runAll(getStatisticsMigrationsPath(), { database: getStatisticsConnection() })) {
        throw new Error('Platform statistics migrations failed');
    }
}
