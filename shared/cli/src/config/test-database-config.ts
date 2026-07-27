import { checksum } from '../context/instance.js';
import { mysqlInternalPort, mysqlRootPassword, mysqlRootUser } from './shared-service-config.js';

/**
 * Where a MySQL installed on this machine listens unless it was configured otherwise. The same port
 * the containers use internally, but not the port they are mapped to on the host (see `buildPorts`).
 */
export const defaultLocalMysqlPort = mysqlInternalPort;

/**
 * Environment variables that point the e2e tests at a MySQL that is already running on this
 * machine. Setting the port is what switches the mode: `stam test e2e` then skips its own MySQL
 * container. `--local-db` / `--no-local-db` override this per run.
 */
export const e2eMysqlPortVariable = 'STAMHOOFD_E2E_MYSQL_PORT';
export const e2eMysqlUserVariable = 'STAMHOOFD_E2E_MYSQL_USER';
export const e2eMysqlPasswordVariable = 'STAMHOOFD_E2E_MYSQL_PASSWORD';

/**
 * The MySQL the e2e tests connect to.
 *
 * - `container`: `stam test e2e` starts a MySQL container of its own (namespaced per worktree, with
 *   a data volume that persists between runs) and shuts it down afterwards.
 * - `local`: a MySQL that is already running on this machine, on `127.0.0.1:<port>`. No container
 *   is started or stopped, which saves the startup time and memory of a second MySQL server.
 */
export type E2eMysqlTarget
    = | { kind: 'container' }
        | { kind: 'local'; port: number; user: string; password: string };

/**
 * Whether this run uses its own MySQL container or one that is already running.
 *
 * `localDb` is the `--local-db` flag: `true` forces a local MySQL, `false` forces the container,
 * and `undefined` (flag not passed) leaves the choice to the environment.
 */
export function resolveE2eMysqlTarget(options: { localDb?: boolean } = {}): E2eMysqlTarget {
    const configuredPort = process.env[e2eMysqlPortVariable]?.trim();

    if (options.localDb === false || (options.localDb === undefined && !configuredPort)) {
        return { kind: 'container' };
    }

    return {
        kind: 'local',
        port: parsePort(configuredPort),
        user: process.env[e2eMysqlUserVariable] ?? mysqlRootUser,
        password: process.env[e2eMysqlPasswordVariable] ?? mysqlRootPassword,
    };
}

/**
 * The databases of the Playwright workers are named `<prefix>-<slot>`. The prefix reaches the
 * Playwright process through this variable, which is set by `stam test e2e`.
 */
export const playwrightDatabasePrefixVariable = 'PLAYWRIGHT_DB_PREFIX';

export const playwrightDatabaseBaseName = 'stamhoofd-playwright';

/**
 * Set by `stam test e2e --clear` when the run connects to a MySQL that keeps running afterwards:
 * there is no data volume to drop, so the Playwright global setup drops the worker databases of
 * this run before migrating them again.
 */
export const playwrightClearDatabasesVariable = 'PLAYWRIGHT_CLEAR_DATABASES';

export function shouldClearPlaywrightDatabases(): boolean {
    return process.env[playwrightClearDatabasesVariable] === 'true';
}

/**
 * Credentials of the MySQL of this run, set by `stam test e2e` when they differ from the root/root
 * of the test environment. Passed under their own names because the test environment overwrites
 * `DB_USER`/`DB_PASS` in `process.env` with its own values whenever it is (re)loaded.
 */
export const playwrightDatabaseUserVariable = 'PLAYWRIGHT_DB_USER';
export const playwrightDatabasePasswordVariable = 'PLAYWRIGHT_DB_PASSWORD';

/**
 * The credentials to connect with, if this run was given any. Undefined values keep the default of
 * the test environment.
 */
export function playwrightDatabaseCredentials(): { user?: string; password?: string } {
    return {
        user: process.env[playwrightDatabaseUserVariable],
        password: process.env[playwrightDatabasePasswordVariable],
    };
}

/** MySQL identifiers are limited to 64 characters. */
const maxDatabaseNameLength = 64;

/** Room the slot suffix needs in a database name, e.g. `-29`. */
const slotSuffixLength = 3;

/**
 * The prefix of the worker databases of this instance. Following the same convention as the
 * development database, the primary worktree keeps the historical bare name and every other
 * worktree appends its instance name, so a run never migrates the databases of a checkout that is
 * on another branch.
 */
export function buildPlaywrightDatabasePrefix(instance: { name: string; primary: boolean }): string {
    const prefix = instance.primary ? playwrightDatabaseBaseName : `${playwrightDatabaseBaseName}-${instance.name}`;
    const maxLength = maxDatabaseNameLength - slotSuffixLength;

    if (prefix.length <= maxLength) {
        return prefix;
    }

    // A long workspace name would otherwise produce a name MySQL rejects. Keep it recognizable and
    // still unique by trading the tail for a checksum of the full name.
    const hash = checksum(prefix).toString(36);
    return `${prefix.slice(0, maxLength - hash.length - 1)}-${hash}`;
}

/**
 * The database of one Playwright slot. Derived from the slot, not from the worker index: a run
 * reserves a block of slots that no other run on this machine uses, so runs started from several
 * worktrees never share a database, even when they all connect to the same MySQL server.
 */
export function playwrightDatabaseName(slot: number, prefix: string = process.env[playwrightDatabasePrefixVariable]?.trim() || playwrightDatabaseBaseName): string {
    return `${prefix}-${slot}`;
}

function parsePort(value: string | undefined): number {
    if (value === undefined || value.length === 0) {
        return defaultLocalMysqlPort;
    }

    const port = Number.parseInt(value, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535 || String(port) !== value) {
        throw new Error(`Invalid ${e2eMysqlPortVariable} "${value}": expected a TCP port number.`);
    }
    return port;
}
