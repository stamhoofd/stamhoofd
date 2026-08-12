import { DatabaseInstance, Migration } from '@simonbackx/simple-database';
import path from 'node:path';
import { getStatisticsDatabaseConfig, getStatisticsPoolOptions } from './database.js';

export function getStatisticsMigrationsPath(): string {
    return path.join(import.meta.dirname, 'migrations');
}

/**
 * Run the migrations of the platform statistics database.
 *
 * That database keeps a migration history of its own, in its own `migrations` table, so it can be
 * moved to another server without dragging the main database along. The migrations are handed the
 * connection to run on, so the shared `Database` keeps pointing at the administration the sync reads
 * for as long as this process lives.
 */
export async function runStatisticsMigrations(): Promise<void> {
    const database = getStatisticsDatabaseConfig().DB_DATABASE;
    const options = getStatisticsPoolOptions();
    const server = new DatabaseInstance({ ...options, database: null });

    try {
        await server.statement(`CREATE DATABASE IF NOT EXISTS ${server.escapeId(database)} DEFAULT CHARACTER SET = \`utf8mb4\` DEFAULT COLLATE = \`utf8mb4_0900_ai_ci\``);
    }
    finally {
        await server.end();
    }

    const connection = new DatabaseInstance({ ...options, database });

    try {
        // todo: changes to simple-database should be published and the new version should be used
        if (!await Migration.runAll(getStatisticsMigrationsPath(), { connection })) {
            throw new Error('Platform statistics migrations failed');
        }
    }
    finally {
        await connection.end();
    }
}
