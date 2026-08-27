import { DatabaseInstance } from '@simonbackx/simple-database';
import type { StatisticsEnvironment } from '@stamhoofd/types/Environment';

export type StatisticsDatabaseConfig = StatisticsEnvironment['statisticsDatabase'];

const defaultMysqlPort = 3306;

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
 * Whether the statistics database is on a different machine than the process reading the
 * administration. It is wherever this is deployed -- the schema lives next to Metabase -- and it is
 * not in development or in the tests, which put both on the same MySQL.
 */
function isOnAnotherServer(config: StatisticsDatabaseConfig): boolean {
    return config.DB_HOST !== STAMHOOFD.stamhoofdDatabase?.DB_HOST;
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

    return isOnAnotherServer(config) ? defaultMysqlPort : undefined;
}

/**
 * Where to reach the statistics database. It lives next to Metabase rather than on the server this
 * runs on, so every connection detail is spelled out instead of inherited from the main database.
 */
export function getStatisticsPoolOptions(): { host: string; user: string; password: string; port: number | undefined; useSSL: boolean } {
    const config = getStatisticsDatabaseConfig();

    return {
        host: config.DB_HOST,
        user: config.DB_USER,
        password: config.DB_PASS,
        port: getStatisticsPort(config),

        // The connection leaves the machine, so it is encrypted: the login it connects with is
        // created with REQUIRE SSL, and MySQL refuses it in plaintext. No CA is shipped here, so
        // this buys encryption and not proof of which server answered. Left off where both databases
        // are on the same MySQL, which is development and the tests.
        useSSL: isOnAnotherServer(config),
    };
}

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
