import { Database, DatabaseInstance, Migration } from '@simonbackx/simple-database';
import path from 'node:path';

export function getStatisticsMigrationsPath(): string {
    return path.join(import.meta.dirname, '../migrations');
}

export function getStatisticsDatabase(): string {
    const database = STAMHOOFD.DB_STATISTICS_DATABASE;

    if (!database) {
        throw new Error('STAMHOOFD.DB_STATISTICS_DATABASE is not set: configure the platform statistics database before running migrations');
    }

    return database;
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
    const database = getStatisticsDatabase();
    const globalDatabase = new DatabaseInstance({ database: null });

    try {
        await globalDatabase.statement(`CREATE DATABASE IF NOT EXISTS ${globalDatabase.escapeId(database)} DEFAULT CHARACTER SET = \`utf8mb4\` DEFAULT COLLATE = \`utf8mb4_0900_ai_ci\``);
    }
    finally {
        await globalDatabase.end();
    }

    await Database.reload({ database });

    try {
        if (!await Migration.runAll(getStatisticsMigrationsPath())) {
            throw new Error('Platform statistics migrations failed');
        }
    }
    finally {
        await Database.reload({});
    }
}
