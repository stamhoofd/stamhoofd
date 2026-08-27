import { TestUtils } from '@stamhoofd/test-utils';
import { shouldRunStatisticsSync, statisticsCronOptions } from './crons.js';

describe('Cron.platform-statistics-sync', () => {
    describe('statisticsCronOptions', () => {
        it('keeps running where the main database is read-only', () => {
            // The syncer is deployed on a replica, whose MySQL is read_only. The cron loop checks
            // that flag against the main database and stops before scheduling anything, so this
            // being false means the sync never runs in production.
            expect(statisticsCronOptions.allowReadOnly).toBe(true);
        });
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
