import { isRunningAhead, ReleasedVersion, Version } from './Version.js';

type Environment = typeof STAMHOOFD.environment;

describe('Version', () => {
    afterEach(() => {
        // This package runs with isolate: false, so a leaked stub would reach the other test files of this worker.
        vi.unstubAllGlobals();
    });

    it('runs one version ahead of the released version in tests', () => {
        expect(STAMHOOFD.environment).toBe('test');
        expect(Version).toBe(ReleasedVersion + 1);
    });

    it('activates NextVersion fields at the current version', () => {
        expect(NextVersion.version).toBe(Version);
    });

    describe('isRunningAhead', () => {
        it.each([
            ['development', true],
            ['test', true],
            ['staging', false],
            ['production', false],
        ] as [Environment, boolean][])('is %s in %s', (environment, expected) => {
            vi.stubGlobal('STAMHOOFD', { ...STAMHOOFD, environment });

            expect(isRunningAhead()).toBe(expected);
        });

        it('throws when STAMHOOFD is not defined, instead of silently falling back to the released version', () => {
            vi.stubGlobal('STAMHOOFD', undefined);

            expect(() => isRunningAhead()).toThrow('STAMHOOFD is not defined');
        });
    });
});
