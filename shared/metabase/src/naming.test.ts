import { describe, expect, it } from 'vitest';
import { metabaseDataSourceName, metabaseReportCollectionName } from './naming.js';

describe('metabaseDataSourceName', () => {
    it('names the data source after the environment so one Metabase can serve several', () => {
        expect(metabaseDataSourceName('keeo')).toBe('Platform statistics (keeo)');
        expect(metabaseDataSourceName('ravot')).toBe('Platform statistics (ravot)');
        expect(metabaseDataSourceName('keeo')).not.toBe(metabaseDataSourceName('ravot'));
    });
});

describe('metabaseReportCollectionName', () => {
    /**
     * A question reads from exactly one database, so two environments cannot share a collection:
     * pushing the second would repoint every dashboard of the first at the wrong data.
     */
    it('gives every environment its own collection', () => {
        expect(metabaseReportCollectionName('keeo')).toBe('Ledenstatistieken (keeo)');
        expect(metabaseReportCollectionName('keeo')).not.toBe(metabaseReportCollectionName('stamhoofd'));
    });
});
