import { describe, expect, it } from 'vitest';
import type { DevelopmentDomains } from '../config/development-config.js';
import { dockerHostGateway } from '../config/shared-service-config.js';
import { buildMetabaseConfigOutput, metabaseDataSourceName } from './metabase-config.js';

describe('metabaseDataSourceName', () => {
    it('names the data source after the environment so one Metabase can serve several', () => {
        expect(metabaseDataSourceName('keeo')).toBe('Platform statistics (keeo)');
        expect(metabaseDataSourceName('ravot')).toBe('Platform statistics (ravot)');
        expect(metabaseDataSourceName('keeo')).not.toBe(metabaseDataSourceName('ravot'));
    });
});

describe('buildMetabaseConfigOutput', () => {
    const output = buildMetabaseConfigOutput(
        { metabase: 'metabase.stamhoofd' } as DevelopmentDomains,
        { name: 'Platform statistics (keeo)', database: 'platform-statistics-keeo', mysqlPort: 3307 },
    );

    it('prints the proxied Metabase URL', () => {
        expect(output).toContain('https://metabase.stamhoofd');
    });

    it('prints data source settings that resolve from inside the container', () => {
        expect(output).toContain(`Host:          ${dockerHostGateway}`);
        expect(output).toContain('Port:          3307');
        expect(output).toContain('Database name: platform-statistics-keeo');
        expect(output).toContain('Name:          Platform statistics (keeo)');
    });
});
