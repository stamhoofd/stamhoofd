import { Database, DatabaseInstance, Migration } from '@simonbackx/simple-database';
import path from 'node:path';
import type { StatisticsEnvironment } from '@stamhoofd/types/Environment';

export type StatisticsDatabaseConfig = StatisticsEnvironment['statisticsDatabase'];

const defaultMysqlPort = 3306;

export function getStatisticsMigrationsPath(): string {
    return path.join(import.meta.dirname, '../migrations');
}

export function getStatisticsDatabaseConfig(): StatisticsDatabaseConfig {
    const config = STAMHOOFD.statisticsDatabase;

    if (!config?.DB_DATABASE) {
        throw new Error('STAMHOOFD.statisticsDatabase is not set: configure the platform statistics database before running migrations');
    }

    // The statistics migrations create tables that share their names with the main database
    // (members, registrations, groups, ...). Pointed at the main database they would collide with
    // it, so the one configuration that could damage it is refused outright. Each lives on its own
    // server, so it takes a match on the server as well as on the name to be the same database.
    const main = STAMHOOFD.stamhoofdDatabase;
    if (main && config.DB_DATABASE === main.DB_DATABASE && config.DB_HOST === main.DB_HOST && (config.DB_PORT ?? main.DB_PORT) === main.DB_PORT) {
        throw new Error(`STAMHOOFD.statisticsDatabase is the main database (${config.DB_DATABASE} on ${config.DB_HOST}): the platform statistics database has to be a separate one`);
    }

    return config;
}

/**
 * The port of a statistics database that does not name one. Undefined follows the port the process
 * connects to the main database on, which is only the same server in development and in tests: on
 * another server that port means nothing, so there it falls back to the MySQL default instead of
 * silently reaching for whatever happens to be listening.
 */
function getStatisticsPort(config: StatisticsDatabaseConfig): number | undefined {
    if (config.DB_PORT !== undefined) {
        return config.DB_PORT;
    }

    return config.DB_HOST === STAMHOOFD.stamhoofdDatabase?.DB_HOST ? undefined : defaultMysqlPort;
}

/**
 * Where to reach the statistics database. It lives next to Metabase rather than on the server this
 * runs on, so every connection detail is spelled out instead of inherited from the main database.
 */
export function getStatisticsPoolOptions(): { host: string; user: string; password: string; port: number | undefined } {
    const config = getStatisticsDatabaseConfig();

    return {
        host: config.DB_HOST,
        user: config.DB_USER,
        password: config.DB_PASS,
        port: getStatisticsPort(config),
    };
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
