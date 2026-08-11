import { TestUtils } from '@stamhoofd/test-utils';
import { isStatisticsSyncEnabled, shouldRunStatisticsSync, statisticsPlatforms } from './crons.js';

describe('Cron.platform-statistics-sync', () => {
    function setEnvironment(options: { userMode: 'platform' | 'organization'; platformName: string; database?: string | undefined }) {
        TestUtils.setEnvironment('userMode', options.userMode);
        TestUtils.setEnvironment('platformName', options.platformName);
        TestUtils.setEnvironment('DB_STATISTICS_DATABASE', 'database' in options ? options.database : 'platform-statistics-tests');
    }

    it('runs for the platforms it was rolled out to', () => {
        for (const platformName of statisticsPlatforms) {
            setEnvironment({ userMode: 'platform', platformName });

            expect(isStatisticsSyncEnabled()).toBe(true);
        }
    });

    it('does not run for another platform', () => {
        setEnvironment({ userMode: 'platform', platformName: 'jamboree' });

        expect(isStatisticsSyncEnabled()).toBe(false);
    });

    it('does not run outside platform mode, where there are no units to report on', () => {
        setEnvironment({ userMode: 'organization', platformName: 'keeo' });

        expect(isStatisticsSyncEnabled()).toBe(false);
    });

    it('does not run when no statistics database is configured', () => {
        setEnvironment({ userMode: 'platform', platformName: 'keeo', database: undefined });

        expect(isStatisticsSyncEnabled()).toBe(false);
    });

    describe('shouldRunStatisticsSync', () => {
        it('only runs at night', () => {
            TestUtils.setEnvironment('environment', 'production');

            for (const hour of [0, 2, 6, 12, 23]) {
                expect(shouldRunStatisticsSync({ now: new Date(2026, 0, 5, hour, 30), lastRun: null })).toBe(false);
            }

            for (const hour of [3, 4, 5]) {
                expect(shouldRunStatisticsSync({ now: new Date(2026, 0, 5, hour, 30), lastRun: null })).toBe(true);
            }
        });

        it('runs once a night, and retries within the window until it succeeded', () => {
            TestUtils.setEnvironment('environment', 'production');

            const firstRun = new Date(2026, 0, 5, 3, 0);

            // A run that never finished leaves lastRun untouched, so the next tick picks it up again.
            expect(shouldRunStatisticsSync({ now: new Date(2026, 0, 5, 3, 5), lastRun: null })).toBe(true);

            expect(shouldRunStatisticsSync({ now: new Date(2026, 0, 5, 3, 5), lastRun: firstRun })).toBe(false);
            expect(shouldRunStatisticsSync({ now: new Date(2026, 0, 5, 5, 55), lastRun: firstRun })).toBe(false);
            expect(shouldRunStatisticsSync({ now: new Date(2026, 0, 6, 3, 0), lastRun: firstRun })).toBe(true);
        });

        it('runs on every tick in development, where waiting for the night is not an option', () => {
            TestUtils.setEnvironment('environment', 'development');

            expect(shouldRunStatisticsSync({ now: new Date(2026, 0, 5, 14, 0), lastRun: new Date(2026, 0, 5, 13, 59) })).toBe(true);
        });
    });
});
