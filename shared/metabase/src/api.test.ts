import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetabaseApi, MetabaseApiError } from './api.js';

type Route = { status?: number; body: unknown };

/**
 * Answer each `METHOD /path` with a canned response and record what was sent. A route may name the
 * query string as well, which is what tells the two snippet listings apart; without one it answers
 * whatever the path was asked with.
 */
function mockFetch(routes: Record<string, Route>) {
    const calls: { key: string; body: any; headers: Record<string, string> }[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const target = new URL(url);
        const key = `${init?.method ?? 'GET'} ${target.pathname}`;
        const route = routes[`${key}${target.search}`] ?? routes[key];
        if (!route) {
            throw new Error(`Unexpected request ${key}${target.search}`);
        }
        const body = typeof init?.body === 'string' ? init.body : undefined;
        calls.push({ key, body: body === undefined ? undefined : JSON.parse(body), headers: (init?.headers ?? {}) as Record<string, string> });
        return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    return calls;
}

const admin = { email: 'dev@stamhoofd.local', password: 'secret', firstName: 'Stamhoofd', lastName: 'Development' };

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('MetabaseApi.authenticate', () => {
    it('completes the setup wizard when the instance is still fresh', async () => {
        const calls = mockFetch({
            'GET /api/session/properties': { body: { 'setup-token': 'token-1' } },
            'POST /api/setup': { body: { id: 'session-1' } },
        });

        const result = await new MetabaseApi('http://localhost:3030').authenticate(admin);

        expect(result.created).toBe(true);
        const setup = calls.find(call => call.key === 'POST /api/setup');
        expect(setup?.body.token).toBe('token-1');
        expect(setup?.body.user.email).toBe(admin.email);
    });

    it('logs in when the instance was already set up', async () => {
        const calls = mockFetch({
            'GET /api/session/properties': { body: { 'setup-token': null } },
            'POST /api/session': { body: { id: 'session-1' } },
        });

        const result = await new MetabaseApi('http://localhost:3030').authenticate(admin);

        expect(result.created).toBe(false);
        expect(calls.find(call => call.key === 'POST /api/session')?.body).toEqual({ username: admin.email, password: admin.password });
    });

    it('reports a rejected login as a 401 so the caller can explain it', async () => {
        mockFetch({
            'GET /api/session/properties': { body: { 'setup-token': null } },
            'POST /api/session': { status: 401, body: { errors: { password: 'did not match stored password' } } },
        });

        const error = await new MetabaseApi('http://localhost:3030').authenticate(admin).catch((thrown: unknown) => thrown);

        expect(error).toBeInstanceOf(MetabaseApiError);
        expect((error as MetabaseApiError).status).toBe(401);
    });
});

describe('MetabaseApi.ensureDatabase', () => {
    const input = { name: 'Platform statistics (keeo)', host: 'host.docker.internal', port: 3307, database: 'statistics-keeo', user: 'root', password: 'root' };

    it('registers the database when it is not registered yet', async () => {
        const calls = mockFetch({
            'GET /api/database': { body: { data: [{ id: 1, name: 'Sample Database', engine: 'sqlite' }] } },
            'POST /api/database': { body: { id: 2 } },
        });

        const result = await new MetabaseApi('http://localhost:3030').ensureDatabase(input);

        expect(result).toMatchObject({ id: 2, created: true });
        expect(calls.find(call => call.key === 'POST /api/database')?.body).toEqual({
            name: input.name,
            engine: 'mysql',
            details: { host: input.host, port: input.port, dbname: input.database, user: input.user, password: input.password, ssl: false },
        });
    });

    it('leaves an existing data source of the same name untouched, but reports its id so it can be resynced', async () => {
        const calls = mockFetch({
            'GET /api/database': { body: { data: [{ id: 2, name: input.name, engine: 'mysql' }] } },
        });

        const result = await new MetabaseApi('http://localhost:3030').ensureDatabase(input);

        expect(result).toMatchObject({ id: 2, created: false });
        expect(calls.some(call => call.key === 'POST /api/database')).toBe(false);
    });

    it('hides the schema-history table, which is infrastructure rather than data', async () => {
        const calls = mockFetch({
            'GET /api/database/2/metadata': { body: { tables: [{ id: 9, name: 'migrations', visibility_type: null }, { id: 10, name: 'members', visibility_type: null }] } },
            'PUT /api/table/9': { body: {} },
        });

        expect(await new MetabaseApi('http://localhost:3030').hideTables(2, ['migrations'])).toEqual(['migrations']);
        expect(calls.find(call => call.key === 'PUT /api/table/9')?.body).toEqual({ visibility_type: 'hidden' });
        // The tables holding the statistics themselves are never touched.
        expect(calls.some(call => call.key === 'PUT /api/table/10')).toBe(false);
    });

    it('leaves an already hidden table alone, so a re-run makes no requests', async () => {
        const calls = mockFetch({
            'GET /api/database/2/metadata': { body: { tables: [{ id: 9, name: 'migrations', visibility_type: 'hidden' }] } },
        });

        expect(await new MetabaseApi('http://localhost:3030').hideTables(2, ['migrations'])).toEqual([]);
        expect(calls.some(call => call.key.startsWith('PUT'))).toBe(false);
    });

    it('gives up waiting for a table the sync has not discovered yet', async () => {
        mockFetch({ 'GET /api/database/2/metadata': { body: { tables: [] } } });

        expect(await new MetabaseApi('http://localhost:3030').hideTables(2, ['migrations'], { timeoutMs: 0 })).toEqual([]);
    });

    it('removes the demo database an older instance was set up with', async () => {
        const calls = mockFetch({
            'GET /api/database': { body: { data: [{ id: 1, name: 'Sample Database', engine: 'sqlite', is_sample: true }, { id: 2, name: input.name, engine: 'mysql' }] } },
            'DELETE /api/database/1': { body: {} },
        });

        expect(await new MetabaseApi('http://localhost:3030').removeSampleDatabase()).toEqual({ removed: true });
        expect(calls.map(call => call.key)).toContain('DELETE /api/database/1');
    });

    it('never deletes a data source that is not the demo database', async () => {
        const calls = mockFetch({
            'GET /api/database': { body: { data: [{ id: 2, name: input.name, engine: 'mysql', is_sample: false }] } },
        });

        expect(await new MetabaseApi('http://localhost:3030').removeSampleDatabase()).toEqual({ removed: false });
        expect(calls.some(call => call.key.startsWith('DELETE'))).toBe(false);
    });

    it('asks Metabase to re-read the schema, so tables created after registration show up', async () => {
        const calls = mockFetch({ 'POST /api/database/2/sync_schema': { body: { status: 'ok' } } });

        await new MetabaseApi('http://localhost:3030').syncDatabaseSchema(2);

        expect(calls.map(call => call.key)).toEqual(['POST /api/database/2/sync_schema']);
    });

    it('accepts a bare array, which older Metabase versions return', async () => {
        mockFetch({
            'GET /api/database': { body: [{ id: 2, name: input.name, engine: 'mysql' }] },
        });

        expect((await new MetabaseApi('http://localhost:3030').ensureDatabase(input)).created).toBe(false);
    });
});

describe('MetabaseApi with an api key', () => {
    const key = 'mb_TESTKEY';

    it('sends the key on every request, so no session is needed', async () => {
        const calls = mockFetch({
            'GET /api/user/current': { body: { id: 3, email: 'reports@stamhoofd.be', is_superuser: true } },
        });

        await new MetabaseApi('https://metabase.example', { apiKey: key }).verifyApiKey();

        expect(calls[0].headers['x-api-key']).toBe(key);
        expect(calls[0].headers['X-Metabase-Session']).toBeUndefined();
    });

    it('returns the account the key belongs to', async () => {
        mockFetch({
            'GET /api/user/current': { body: { id: 3, email: 'reports@stamhoofd.be', is_superuser: true } },
        });

        expect((await new MetabaseApi('https://metabase.example', { apiKey: key }).verifyApiKey()).email).toBe('reports@stamhoofd.be');
    });

    /**
     * A key is created by hand and can be revoked there, so this has to fail before anything is
     * written rather than as a 401 halfway through the report.
     */
    it('explains a revoked key instead of failing halfway through', async () => {
        mockFetch({
            'GET /api/user/current': { status: 401, body: { message: 'Unauthenticated' } },
        });

        await expect(new MetabaseApi('https://metabase.example', { apiKey: key }).verifyApiKey())
            .rejects.toThrow('rejected the api key');
    });

    it('refuses a key that is not an admin, which cannot write questions', async () => {
        mockFetch({
            'GET /api/user/current': { body: { id: 4, email: 'viewer@stamhoofd.be', is_superuser: false } },
        });

        await expect(new MetabaseApi('https://metabase.example', { apiKey: key }).verifyApiKey())
            .rejects.toThrow('is not an admin');
    });

    it('does not send a key when none was configured', async () => {
        const calls = mockFetch({ 'GET /api/database': { body: { data: [] } } });

        await new MetabaseApi('http://localhost:3030').listDatabases();

        expect(calls[0].headers['x-api-key']).toBeUndefined();
    });
});

describe('MetabaseApi.requireDatabaseByName', () => {
    it('finds the data source the report writes against', async () => {
        mockFetch({ 'GET /api/database': { body: { data: [{ id: 7, name: 'Platform statistics (keeo)', engine: 'mysql' }] } } });

        expect((await new MetabaseApi('https://metabase.example').requireDatabaseByName('Platform statistics (keeo)')).id).toBe(7);
    });

    /**
     * A server's data source holds credentials of its own and connects over SSL, so it is added by
     * hand. Naming what is registered turns a typo into an answer instead of a silent miss.
     */
    it('lists what is registered when the data source is missing', async () => {
        mockFetch({ 'GET /api/database': { body: { data: [{ id: 7, name: 'Platform statistics (ravot)', engine: 'mysql' }] } } });

        await expect(new MetabaseApi('https://metabase.example').requireDatabaseByName('Platform statistics (keeo)'))
            .rejects.toThrow('only: Platform statistics (ravot)');
    });
});

describe('MetabaseApi snippets', () => {
    /**
     * A name is held by an archived snippet as much as by a live one, and Metabase deletes neither,
     * so the one in the trash has to be found rather than written a second time under a taken name.
     */
    it('lists the archived fragments beside the live ones', async () => {
        mockFetch({
            'GET /api/native-query-snippet': { body: [{ id: 1, name: 'facts', content: 'SELECT 1' }] },
            'GET /api/native-query-snippet?archived=true': { body: [{ id: 2, name: 'leden', content: 'SELECT 2' }] },
        });

        const snippets = await new MetabaseApi('http://127.0.0.1:3030').listSnippets();

        expect(snippets.map(snippet => snippet.name)).toEqual(['facts', 'leden']);
    });

    it('creates a fragment that is not there yet', async () => {
        const calls = mockFetch({ 'POST /api/native-query-snippet': { body: { id: 7 } } });

        const id = await new MetabaseApi('http://127.0.0.1:3030').saveSnippet({ name: 'facts', content: 'SELECT 1' });

        expect(id).toBe(7);
        expect(calls[0].body).toEqual({ name: 'facts', content: 'SELECT 1' });
    });

    /** Updating in place keeps the id every question points at, and brings an archived one back. */
    it('updates a fragment that is, and unarchives it', async () => {
        const calls = mockFetch({ 'PUT /api/native-query-snippet/7': { body: { id: 7 } } });

        const id = await new MetabaseApi('http://127.0.0.1:3030').saveSnippet({ name: 'facts', content: 'SELECT 2' }, 7);

        expect(id).toBe(7);
        // Metabase applies a description it is handed, so leaving it out is what keeps the one the
        // snippet sidebar shows rather than emptying it on every run.
        expect(calls[0].body).toEqual({ name: 'facts', content: 'SELECT 2', archived: false });
    });
});

describe('MetabaseApi.renameCollection', () => {
    /** Renaming keeps the id, and with it everything that points into the collection. */
    it('renames in place', async () => {
        const calls = mockFetch({ 'PUT /api/collection/5': { body: {} } });

        await new MetabaseApi('http://127.0.0.1:3030').renameCollection(5, 'Ledenstatistieken');

        expect(calls).toEqual([expect.objectContaining({ key: 'PUT /api/collection/5', body: { name: 'Ledenstatistieken' } })]);
    });
});
