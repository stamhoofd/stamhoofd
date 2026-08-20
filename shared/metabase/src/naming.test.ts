import { describe, expect, it } from 'vitest';
import { isLegacyReportCollectionName, metabaseDataSourceName, metabaseReportCollectionName } from './naming.js';

describe('metabaseDataSourceName', () => {
    it('names the data source after the environment so one Metabase can serve several', () => {
        expect(metabaseDataSourceName('keeo')).toBe('Platform statistics (keeo)');
        expect(metabaseDataSourceName('ravot')).toBe('Platform statistics (ravot)');
        expect(metabaseDataSourceName('keeo')).not.toBe(metabaseDataSourceName('ravot'));
    });
});

describe('metabaseReportCollectionName', () => {
    /**
     * One collection, whichever platform it counts: a local Metabase shows the report of the
     * environment written last, and a server holds one platform to begin with.
     */
    it('names the collection after the report and not after a platform', () => {
        expect(metabaseReportCollectionName).toBe('Statistieken');
    });
});

describe('isLegacyReportCollectionName', () => {
    /** Which collection may be renamed into the one written now, and which may not. */
    it('recognises the collection this wrote while there was one per environment', () => {
        expect(isLegacyReportCollectionName('Ledenstatistieken (keeo)')).toBe(true);
        expect(isLegacyReportCollectionName('Ledenstatistieken (stamhoofd)')).toBe(true);
    });

    it('leaves anything else alone', () => {
        expect(isLegacyReportCollectionName(metabaseReportCollectionName)).toBe(false);
        expect(isLegacyReportCollectionName('Onze cijfers (keeo)')).toBe(false);
        expect(isLegacyReportCollectionName('Ledenstatistieken (keeo) kopie')).toBe(false);
    });
});
