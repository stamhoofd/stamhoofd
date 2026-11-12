import { TestUtils } from '@stamhoofd/test-utils';
import { DatabaseInstance } from '@node/database';
import type { StatisticsEnvironment } from '@stamhoofd/types/Environment';
import { getStatisticsDatabaseConfig, getStatisticsPoolOptions } from './database.js';

describe('getStatisticsDatabaseConfig', () => {
    it('refuses to migrate the main database, whose tables it would collide with', () => {
        TestUtils.setEnvironment('statisticsDatabase', { ...STAMHOOFD.stamhoofdDatabase });

        expect(() => getStatisticsDatabaseConfig()).toThrow('has to be a separate one');
    });

    it('refuses the main database even when it inherits its port instead of naming one', () => {
        TestUtils.setEnvironment('stamhoofdDatabase', {
            ...STAMHOOFD.stamhoofdDatabase,
            DB_PORT: 3307,
        });
        TestUtils.setEnvironment('statisticsDatabase', {
            ...STAMHOOFD.stamhoofdDatabase,
            DB_PORT: undefined,
        });

        expect(() => getStatisticsDatabaseConfig()).toThrow('has to be a separate one');
    });

    it('accepts the same database name on another server, which is a database of its own', () => {
        TestUtils.setEnvironment('statisticsDatabase', {
            ...STAMHOOFD.stamhoofdDatabase,
            DB_HOST: 'statistics.example',
        });

        expect(getStatisticsDatabaseConfig().DB_HOST).toBe('statistics.example');
    });

    it('refuses to run when no statistics database is configured', () => {
        TestUtils.setEnvironment(
            'statisticsDatabase',
            undefined as unknown as StatisticsEnvironment['statisticsDatabase'],
        );

        expect(() => getStatisticsDatabaseConfig()).toThrow('is not set');
    });
});

const certs = { DB_CA: '/certs/ca.pem', DB_CERT: '/certs/cert.pem', DB_KEY: '/certs/key.pem' };

describe('getStatisticsPoolOptions', () => {
    it('follows the port of the main database while both are on one server', () => {
        expect(STAMHOOFD.statisticsDatabase.DB_HOST).toBe(STAMHOOFD.stamhoofdDatabase.DB_HOST);

        expect(getStatisticsPoolOptions().port).toBeUndefined();
    });

    it('falls back to the default port on another server, whose ports are its own', () => {
        TestUtils.setEnvironment('statisticsDatabase', {
            ...STAMHOOFD.statisticsDatabase,
            DB_HOST: 'statistics.example',
            ...certs,
        });

        expect(getStatisticsPoolOptions().port).toBe(3306);
    });

    it('uses the port it was given', () => {
        TestUtils.setEnvironment('statisticsDatabase', {
            ...STAMHOOFD.statisticsDatabase,
            DB_HOST: 'statistics.example',
            DB_PORT: 3399,
            ...certs,
        });

        expect(getStatisticsPoolOptions().port).toBe(3399);
    });

    it('presents the client certificate to another server, whose login is created with REQUIRE X509', () => {
        TestUtils.setEnvironment('statisticsDatabase', {
            ...STAMHOOFD.statisticsDatabase,
            DB_HOST: 'statistics.example',
            ...certs,
        });

        expect(getStatisticsPoolOptions()).toMatchObject({
            useSSL: true,
            ca: '/certs/ca.pem',
            cert: '/certs/cert.pem',
            key: '/certs/key.pem',
        });
    });

    it('refuses to connect to another server without a client certificate', () => {
        TestUtils.setEnvironment('statisticsDatabase', {
            ...STAMHOOFD.statisticsDatabase,
            DB_HOST: 'statistics.example',
        });

        expect(() => getStatisticsPoolOptions()).toThrow(/DB_CERT and DB_KEY/);
    });

    it('does not ask for TLS while both databases are on one MySQL', () => {
        expect(STAMHOOFD.statisticsDatabase.DB_HOST).toBe(STAMHOOFD.stamhoofdDatabase.DB_HOST);

        expect(getStatisticsPoolOptions()).toMatchObject({
            useSSL: false,
            cert: undefined,
            key: undefined,
        });
    });

    it('requires a CA even when the client certificate is present', () => {
        TestUtils.setEnvironment('statisticsDatabase', {
            ...STAMHOOFD.statisticsDatabase, DB_HOST: 'statistics.example', ...certs, DB_CA: undefined,
        });
        expect(() => getStatisticsPoolOptions()).toThrow(/DB_CA/);
    });

    it('supports explicit managed server-auth TLS and keeps TCP routing separate from identity', () => {
        TestUtils.setEnvironment('statisticsDatabase', {
            ...STAMHOOFD.statisticsDatabase, DB_HOST: '10.90.0.4', DB_PORT: 3306,
            DB_CA: '/certs/managed-ca.pem', DB_TLS_MODE: 'server', DB_TLS_SERVER_NAME: 'mysql.example.com',
        });
        expect(getStatisticsPoolOptions()).toMatchObject({
            host: 'mysql.example.com', connectHost: '10.90.0.4', port: 3306,
            useSSL: true, ca: '/certs/managed-ca.pem', verifyIdentity: true, cert: null, key: null,
        });
    });

    it('does not silently downgrade client authentication or endpoint verification', () => {
        TestUtils.setEnvironment('statisticsDatabase', {
            ...STAMHOOFD.statisticsDatabase, DB_HOST: '10.90.0.4', DB_CA: '/certs/managed-ca.pem', DB_TLS_MODE: 'server',
        });
        expect(() => getStatisticsPoolOptions()).toThrow(/DB_TLS_SERVER_NAME/);
    });

    it('never loads inherited client credentials in managed server-auth mode', async () => {
        TestUtils.setEnvironment('statisticsDatabase', {
            ...STAMHOOFD.statisticsDatabase, DB_HOST: '10.90.0.4', DB_PORT: 3306,
            DB_CA: '/managed-ca.pem', DB_TLS_MODE: 'server', DB_TLS_SERVER_NAME: 'mysql.example.com',
        });
        vi.stubEnv('DB_CERT', '/must-not-read-legacy-client.pem');
        vi.stubEnv('DB_KEY', '/must-not-read-legacy-client-key.pem');
        const fs = await import('node:fs');
        const read = vi.spyOn(fs.default, 'readFileSync').mockImplementation((file) => {
            if (file === '/managed-ca.pem') {
                return Buffer.from('managed-ca');
            }
            throw new Error(`Unexpected inherited credential read: ${String(file)}`);
        });
        let database: DatabaseInstance | undefined;
        try {
            database = new DatabaseInstance({ ...getStatisticsPoolOptions(), database: null });
            expect(read.mock.calls.map(([file]) => file)).toEqual(['/managed-ca.pem']);
        } finally {
            read.mockRestore();
            vi.unstubAllEnvs();
            await database?.end();
        }
    });
});
