import { afterEach, describe, expect, it } from 'vitest';
import {
    buildPlaywrightDatabasePrefix,
    e2eMysqlPasswordVariable,
    e2eMysqlPortVariable,
    e2eMysqlUserVariable,
    playwrightClearDatabasesVariable,
    playwrightDatabaseCredentials,
    playwrightDatabaseName,
    playwrightDatabasePasswordVariable,
    playwrightDatabasePrefixVariable,
    playwrightDatabaseUserVariable,
    resolveE2eMysqlTarget,
    shouldClearPlaywrightDatabases,
} from './test-database-config.js';

const variables = [
    e2eMysqlPortVariable,
    e2eMysqlUserVariable,
    e2eMysqlPasswordVariable,
    playwrightDatabasePrefixVariable,
    playwrightDatabaseUserVariable,
    playwrightDatabasePasswordVariable,
    playwrightClearDatabasesVariable,
];

afterEach(() => {
    variables.forEach(variable => delete process.env[variable]);
});

describe('resolveE2eMysqlTarget', () => {
    it('starts a container when nothing is configured', () => {
        expect(resolveE2eMysqlTarget()).toEqual({ kind: 'container' });
    });

    it('uses a local MySQL on 3306 with --local-db', () => {
        expect(resolveE2eMysqlTarget({ localDb: true })).toEqual({ kind: 'local', port: 3306, user: 'root', password: 'root' });
    });

    it('uses a local MySQL when a port is configured', () => {
        process.env[e2eMysqlPortVariable] = '3307';

        expect(resolveE2eMysqlTarget()).toEqual({ kind: 'local', port: 3307, user: 'root', password: 'root' });
    });

    it('takes the configured credentials', () => {
        process.env[e2eMysqlPortVariable] = '3306';
        process.env[e2eMysqlUserVariable] = 'tests';
        process.env[e2eMysqlPasswordVariable] = '';

        expect(resolveE2eMysqlTarget()).toEqual({ kind: 'local', port: 3306, user: 'tests', password: '' });
    });

    it('lets --no-local-db win over a configured port', () => {
        process.env[e2eMysqlPortVariable] = '3306';

        expect(resolveE2eMysqlTarget({ localDb: false })).toEqual({ kind: 'container' });
    });

    it('rejects a port that is not a TCP port', () => {
        process.env[e2eMysqlPortVariable] = '3306abc';

        expect(() => resolveE2eMysqlTarget()).toThrow(`Invalid ${e2eMysqlPortVariable}`);
    });

    it('rejects a port outside the TCP range', () => {
        process.env[e2eMysqlPortVariable] = '70000';

        expect(() => resolveE2eMysqlTarget()).toThrow(`Invalid ${e2eMysqlPortVariable}`);
    });
});

describe('buildPlaywrightDatabasePrefix', () => {
    it('keeps the bare name for the primary worktree', () => {
        expect(buildPlaywrightDatabasePrefix({ name: 'stamhoofd', primary: true })).toBe('stamhoofd-playwright');
    });

    it('adds the instance name of another worktree', () => {
        expect(buildPlaywrightDatabasePrefix({ name: 'stamhoofd-feature-sso', primary: false })).toBe('stamhoofd-playwright-stamhoofd-feature-sso');
    });

    it('keeps long instance names within the MySQL identifier limit', () => {
        const prefix = buildPlaywrightDatabasePrefix({ name: 'stamhoofd-a-very-long-worktree-name-that-keeps-on-going', primary: false });

        expect(playwrightDatabaseName(29, prefix).length).toBeLessThanOrEqual(64);
        expect(prefix.startsWith('stamhoofd-playwright-stamhoofd-a-very-long-worktree')).toBe(true);
    });

    it('gives two long instance names different prefixes', () => {
        const first = buildPlaywrightDatabasePrefix({ name: 'stamhoofd-a-very-long-worktree-name-that-keeps-on-going-one', primary: false });
        const second = buildPlaywrightDatabasePrefix({ name: 'stamhoofd-a-very-long-worktree-name-that-keeps-on-going-two', primary: false });

        expect(first).not.toBe(second);
    });
});

describe('playwrightDatabaseName', () => {
    it('names a database after its slot', () => {
        process.env[playwrightDatabasePrefixVariable] = 'stamhoofd-playwright-stamhoofd-6';

        expect(playwrightDatabaseName(4)).toBe('stamhoofd-playwright-stamhoofd-6-4');
    });

    it('falls back to the base name without a configured prefix', () => {
        expect(playwrightDatabaseName(0)).toBe('stamhoofd-playwright-0');
    });
});

describe('playwrightDatabaseCredentials', () => {
    it('keeps the test environment defaults when nothing was passed', () => {
        expect(playwrightDatabaseCredentials()).toEqual({ user: undefined, password: undefined });
    });

    it('reads an empty password as a configured password', () => {
        process.env[playwrightDatabaseUserVariable] = 'tests';
        process.env[playwrightDatabasePasswordVariable] = '';

        expect(playwrightDatabaseCredentials()).toEqual({ user: 'tests', password: '' });
    });
});

describe('shouldClearPlaywrightDatabases', () => {
    it('only clears when asked to', () => {
        expect(shouldClearPlaywrightDatabases()).toBe(false);

        process.env[playwrightClearDatabasesVariable] = 'true';

        expect(shouldClearPlaywrightDatabases()).toBe(true);
    });
});
