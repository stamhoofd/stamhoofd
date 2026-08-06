import { TestUtils } from '@stamhoofd/test-utils';
import { isStatisticsSyncEnabled, statisticsPlatforms } from './platform-statistics-sync.js';

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
});
