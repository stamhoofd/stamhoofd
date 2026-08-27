import { TestUtils } from '@stamhoofd/test-utils';
import type { StatisticsEnvironment } from '@stamhoofd/types/Environment';
import { getStatisticsDatabaseConfig, getStatisticsPoolOptions } from './database.js';

describe('getStatisticsDatabaseConfig', () => {
    it('refuses to migrate the main database, whose tables it would collide with', () => {
        TestUtils.setEnvironment('statisticsDatabase', { ...STAMHOOFD.stamhoofdDatabase });

        expect(() => getStatisticsDatabaseConfig()).toThrow('has to be a separate one');
    });

    it('refuses the main database even when it inherits its port instead of naming one', () => {
        TestUtils.setEnvironment('stamhoofdDatabase', { ...STAMHOOFD.stamhoofdDatabase, DB_PORT: 3307 });
        TestUtils.setEnvironment('statisticsDatabase', { ...STAMHOOFD.stamhoofdDatabase, DB_PORT: undefined });

        expect(() => getStatisticsDatabaseConfig()).toThrow('has to be a separate one');
    });

    it('accepts the same database name on another server, which is a database of its own', () => {
        TestUtils.setEnvironment('statisticsDatabase', { ...STAMHOOFD.stamhoofdDatabase, DB_HOST: 'statistics.example' });

        expect(getStatisticsDatabaseConfig().DB_HOST).toBe('statistics.example');
    });

    it('refuses to run when no statistics database is configured', () => {
        TestUtils.setEnvironment('statisticsDatabase', undefined as unknown as StatisticsEnvironment['statisticsDatabase']);

        expect(() => getStatisticsDatabaseConfig()).toThrow('is not set');
    });
});

describe('getStatisticsPoolOptions', () => {
    it('follows the port of the main database while both are on one server', () => {
        expect(STAMHOOFD.statisticsDatabase.DB_HOST).toBe(STAMHOOFD.stamhoofdDatabase.DB_HOST);

        expect(getStatisticsPoolOptions().port).toBeUndefined();
    });

    it('falls back to the default port on another server, whose ports are its own', () => {
        TestUtils.setEnvironment('statisticsDatabase', { ...STAMHOOFD.statisticsDatabase, DB_HOST: 'statistics.example' });

        expect(getStatisticsPoolOptions().port).toBe(3306);
    });

    it('uses the port it was given', () => {
        TestUtils.setEnvironment('statisticsDatabase', { ...STAMHOOFD.statisticsDatabase, DB_HOST: 'statistics.example', DB_PORT: 3399 });

        expect(getStatisticsPoolOptions().port).toBe(3399);
    });

    it('encrypts the connection to another server, whose login is created with REQUIRE SSL', () => {
        // The devops grant pins `REQUIRE SSL` on this user, and MySQL refuses it in plaintext: the
        // two have to stay switched on together or the sync cannot connect at all.
        TestUtils.setEnvironment('statisticsDatabase', { ...STAMHOOFD.statisticsDatabase, DB_HOST: 'statistics.example' });

        expect(getStatisticsPoolOptions().useSSL).toBe(true);
    });

    it('does not ask for TLS while both databases are on one MySQL', () => {
        expect(STAMHOOFD.statisticsDatabase.DB_HOST).toBe(STAMHOOFD.stamhoofdDatabase.DB_HOST);

        expect(getStatisticsPoolOptions().useSSL).toBe(false);
    });
});
