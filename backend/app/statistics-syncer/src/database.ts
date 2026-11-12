import { DatabaseInstance } from '@node/database';
import type { PoolOptions } from '@node/database';
import type { StatisticsEnvironment } from '@stamhoofd/types/Environment';

export type StatisticsDatabaseConfig = StatisticsEnvironment['statisticsDatabase'];

const defaultMysqlPort = 3306;

export function getStatisticsDatabaseConfig(): StatisticsDatabaseConfig {
    const config = STAMHOOFD.statisticsDatabase;

    if (!config?.DB_DATABASE) {
        throw new Error(
            'STAMHOOFD.statisticsDatabase is not set: configure the platform statistics database before running migrations',
        );
    }

    // The statistics migrations create tables that share their names with the main database
    // (members, registrations, groups, ...). Pointed at the main database they would collide with
    // it, so the one configuration that could damage it is refused outright. Each lives on its own
    // server, so it takes a match on the server as well as on the name to be the same database.
    const main = STAMHOOFD.stamhoofdDatabase;
    if (
        main &&
        config.DB_DATABASE === main.DB_DATABASE &&
        config.DB_HOST === main.DB_HOST &&
        (config.DB_PORT ?? main.DB_PORT) === main.DB_PORT
    ) {
        throw new Error(
            `STAMHOOFD.statisticsDatabase is the main database (${config.DB_DATABASE} on ${config.DB_HOST}): the platform statistics database has to be a separate one`,
        );
    }

    return config;
}

/**
 * Whether the statistics database is on a different machine than the process reading the
 * administration. It is wherever this is deployed, and it is
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
 * Where to reach the statistics writer/primary. Connection details are independent of the local
 * administration, and reads through this connection deliberately stay on the primary.
 */
export function getStatisticsPoolOptions(): PoolOptions {
    const config = getStatisticsDatabaseConfig();
    const useSSL = isOnAnotherServer(config);

    // Legacy logins use REQUIRE X509. Server-only authentication must be explicitly selected;
    // otherwise a missing client certificate is an error, not an implicit downgrade.
    if (useSSL && config.DB_TLS_MODE !== 'server' && (!config.DB_CERT || !config.DB_KEY)) {
        throw new Error(
            'STAMHOOFD.statisticsDatabase.DB_CERT and DB_KEY are required to connect to a statistics database on another server',
        );
    }

    if (config.DB_TLS_MODE === 'server' && (!useSSL || !config.DB_TLS_SERVER_NAME)) {
        throw new Error('Server-auth TLS requires a remote destination and DB_TLS_SERVER_NAME');
    }

    const base = {
        host: config.DB_HOST,
        user: config.DB_USER,
        password: config.DB_PASS,
        port: getStatisticsPort(config),
        cert: config.DB_TLS_MODE === 'server' ? null : useSSL ? config.DB_CERT : undefined,
        key: config.DB_TLS_MODE === 'server' ? null : useSSL ? config.DB_KEY : undefined,
    };

    if (!useSSL) {
        if (config.DB_TLS_SERVER_NAME) {
            throw new Error('DB_TLS_SERVER_NAME requires a remote TLS destination');
        }
        return { ...base, useSSL: false };
    }
    if (!config.DB_CA) {
        throw new Error('STAMHOOFD.statisticsDatabase.DB_CA is required for remote TLS');
    }
    if (config.DB_TLS_SERVER_NAME) {
        return {
            ...base, useSSL: true, ca: config.DB_CA, verifyIdentity: true,
            host: config.DB_TLS_SERVER_NAME, connectHost: config.DB_HOST,
        };
    }
    return { ...base, useSSL: true, ca: config.DB_CA };
}

let connection: DatabaseInstance | undefined;

/**
 * A connection of its own to the platform statistics database.
 *
 * The shared `Database` stays pointed at the main administration, which the sync reads through the
 * models. Remote destinations use a separate MySQL; the administration never moves with them.
 */
export function getStatisticsConnection(): DatabaseInstance {
    connection ??= new DatabaseInstance({
        ...getStatisticsPoolOptions(),
        database: getStatisticsDatabaseConfig().DB_DATABASE,
    });
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
