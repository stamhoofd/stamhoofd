import { TestUtils } from '@stamhoofd/test-utils';
import { BootChecksService } from './BootChecksService.js';
import { DatabaseCollationService } from './DatabaseCollationService.js';
import { StartupHealthService } from './StartupHealthService.js';

describe('BootChecksService', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        StartupHealthService.clearForTesting();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        StartupHealthService.clearForTesting();
    });

    test('Throws outside production when collation mismatches', async () => {
        TestUtils.setEnvironment('environment', 'development');

        vi.spyOn(DatabaseCollationService, 'getMismatchError').mockResolvedValue('MySQL collation mismatch test error');

        await expect(BootChecksService.checkDatabaseCollation()).rejects.toThrow('MySQL collation mismatch test error');
    });

    test('Marks startup unhealthy in production when collation mismatches', async () => {
        TestUtils.setEnvironment('environment', 'production');

        vi.spyOn(DatabaseCollationService, 'getMismatchError').mockResolvedValue('MySQL collation mismatch test error');

        await expect(BootChecksService.checkDatabaseCollation()).resolves.toBeUndefined();
        expect(StartupHealthService.getErrors()).toContain('MySQL collation mismatch test error');
    });
});
