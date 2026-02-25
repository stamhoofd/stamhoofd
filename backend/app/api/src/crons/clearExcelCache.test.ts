import { Dirent } from 'fs';
import fs from 'fs/promises';
import { clearExcelCacheHelper } from './clearExcelCache.js';

const testPath = '/Users/user/project/backend/app/api/.cache';
jest.mock('fs/promises');
const fsMock = jest.mocked(fs, { shallow: true });

describe('clearExcelCacheHelper', () => {
    it('should only run between 3 and 6 AM', async () => {
        // #region arrange
        const shouldFail = [
            new Date(2024, 1, 1, 0, 0),
            new Date(2024, 1, 1, 2, 50),
            new Date(2024, 1, 1, 2, 59, 59, 999),
            new Date(2024, 1, 1, 6, 0),
        ];

        const shouldPass = [
            new Date(2024, 1, 1, 3, 0),
            new Date(2024, 1, 1, 3, 55),
            new Date(2024, 1, 1, 5, 59, 59, 999),
        ];

        fsMock.readdir.mockReturnValue(Promise.resolve([]));
        // #endregion

        // #region act and assert
        for (const date of shouldFail) {
            const didClear = await clearExcelCacheHelper({
                lastExcelClear: null,
                now: date,
                cachePath: testPath,
                environment: 'production',
            });

            expect(didClear).toBeFalse();
        }

        for (const date of shouldPass) {
            const didClear = await clearExcelCacheHelper({
                lastExcelClear: null,
                now: date,
                cachePath: testPath,
                environment: 'production',
            });

            expect(didClear).toBeTrue();
        }
        // #endregion
    });

    it('should only run once each day', async () => {
        // #region arrange
        const firstTry = new Date(2024, 1, 1, 3, 0);
        const secondTry = new Date(2024, 1, 1, 3, 5);
        const thirdTry = new Date(2024, 1, 2, 3, 0);
        const fourthTry = new Date(2024, 1, 2, 3, 5);

        fsMock.readdir.mockReturnValue(Promise.resolve([]));
        // #endregion

        // #region act and assert

        // second try, should fail because 5 min earlier the cache was cleared
        const didClearSecondTry = await clearExcelCacheHelper({
            lastExcelClear: firstTry.getTime(),
            now: secondTry,
            cachePath: testPath,
            environment: 'production',
        });

        expect(didClearSecondTry).toBeFalse();

        // third try, should pass because the last clear was more than a day ago
        const didClearThirdTry = await clearExcelCacheHelper({
            lastExcelClear: secondTry.getTime(),
            now: thirdTry,
            cachePath: testPath,
            environment: 'production',
        });

        expect(didClearThirdTry).toBeTrue();

        // fourth try, should fail because 5 min earlier the cache was cleared
        const didClearFourthTry = await clearExcelCacheHelper({
            lastExcelClear: thirdTry.getTime(),
            now: fourthTry,
            cachePath: testPath,
            environment: 'production',
        });

        expect(didClearFourthTry).toBeFalse();
        // #endregion
    });

    it('should delete old cache only', async () => {
        // #region arrange
        const now = new Date(2024, 0, 5, 3, 5);

        const dir1 = new Dirent();
        dir1.name = '2024-01-01';

        const dir2 = new Dirent();
        dir2.name = '2024-01-02';

        const dir3 = new Dirent();
        dir3.name = '2024-01-03';

        const dir4 = new Dirent();
        dir4.name = '2024-01-04';

        const dir5 = new Dirent();
        dir5.name = '2024-01-05';

        const dir6 = new Dirent();
        dir6.name = 'not-a-date';

        const dir7 = new Dirent();
        dir7.name = 'noDate';

        const file1 = new Dirent();
        file1.name = 'some-file';
        file1.parentPath = testPath;
        file1.isDirectory = () => false;

        const directories = [dir1, dir2, dir3, dir4, dir5, dir6, dir7];

        directories.forEach((dir) => {
            dir.parentPath = testPath;
            dir.isDirectory = () => true;
        });

        fsMock.readdir.mockReturnValue(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            Promise.resolve([...directories, file1]) as any,
        );
        // #endregion

        // act
        await clearExcelCacheHelper({
            lastExcelClear: null,
            now,
            cachePath: testPath,
            environment: 'production',
        });

        // assert
        expect(fsMock.rm).toHaveBeenCalledTimes(2);
        expect(fsMock.rm).toHaveBeenCalledWith('/Users/user/project/backend/app/api/.cache/2024-01-01', { recursive: true, force: true });
        expect(fsMock.rm).toHaveBeenCalledWith('/Users/user/project/backend/app/api/.cache/2024-01-02', { recursive: true, force: true });
    });
});
