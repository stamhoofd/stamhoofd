import { ReleasedVersion, Version } from './Version.js';

describe('Version', () => {
    it('runs one version ahead of the released version in tests', () => {
        expect(STAMHOOFD.environment).toBe('test');
        expect(Version).toBe(ReleasedVersion + 1);
    });

    it('activates NextVersion fields at the current version', () => {
        expect(NextVersion.version).toBe(Version);
    });
});
