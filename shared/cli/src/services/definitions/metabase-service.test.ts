import { describe, expect, it } from 'vitest';
import { dockerHostGateway, metabaseAppDatabase, metabaseContainer, metabaseImage, metabaseInternalPort, mysqlRootPassword, mysqlRootUser } from '../../config/shared-service-config.js';
import { MetabaseService } from './metabase-service.js';

describe('MetabaseService.dockerArgs', () => {
    const args = MetabaseService.dockerArgs(3030, 3307, 'https://metabase.stamhoofd');

    function envValue(name: string): string | undefined {
        return args.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1);
    }

    it('publishes the container port on the host port', () => {
        expect(args).toContain('--name');
        expect(args).toContain(metabaseContainer);
        expect(args).toContain(`127.0.0.1:3030:${metabaseInternalPort}`);
        expect(args.at(-1)).toBe(metabaseImage);
    });

    it('points the application database at the shared MySQL container through the host gateway', () => {
        expect(envValue('MB_DB_TYPE')).toBe('mysql');
        expect(envValue('MB_DB_HOST')).toBe(dockerHostGateway);
        expect(envValue('MB_DB_PORT')).toBe('3307');
        expect(envValue('MB_DB_DBNAME')).toBe(metabaseAppDatabase);
        expect(envValue('MB_DB_USER')).toBe(mysqlRootUser);
        expect(envValue('MB_DB_PASS')).toBe(mysqlRootPassword);
    });

    it('maps the host gateway so the MySQL host also resolves on Linux', () => {
        expect(args).toContain('--add-host');
        expect(args).toContain(`${dockerHostGateway}:host-gateway`);
    });

    it('sets the site URL so Metabase builds links on its proxied hostname', () => {
        expect(envValue('MB_SITE_URL')).toBe('https://metabase.stamhoofd');
    });

    it('starts without the demo database Metabase would otherwise create', () => {
        expect(envValue('MB_LOAD_SAMPLE_CONTENT')).toBe('false');
    });
});
