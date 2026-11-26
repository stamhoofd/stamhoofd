import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MollieToken, OrganizationFactory } from '@stamhoofd/models';

function run(entry: string, optIn = true, args: string[] = []) {
    const dir = mkdtempSync(path.join(tmpdir(), 'backend-log-test-'));
    const file = path.join(dir, 'dedicated.jsonl');
    const fd = openSync(file, 'ax', 0o600);
    try {
        writeFileSync(path.join(dir, '.env.json'), '{"member":canary-invalid-config}');
        const child = spawnSync(process.execPath, [entry, ...args], {
            cwd: dir,
            encoding: 'utf8',
            timeout: 15000,
            env: {
                PATH: process.env.PATH,
                DB_PORT: process.env.DB_PORT,
                NODE_ENV: 'production',
                STAM_BACKEND_LOG_FD: optIn ? '3' : '',
            },
            stdio: ['ignore', 'pipe', 'pipe', fd],
        });
        if (child.error) throw child.error;
        return {
            status: child.status,
            local: child.stdout + child.stderr,
            dedicated: readFileSync(file, 'utf8'),
        };
    } finally {
        closeSync(fd);
        rmSync(dir, { recursive: true, force: true });
    }
}

it('keeps malformed input, SQL, driver errors and transform failures out of final output', () => {
    const result = run(path.resolve(import.meta.dirname, '../fixtures/backend-log-probe.mjs'));
    expect(result.local).not.toMatch(/canary[-_]/);
    expect(result.status, result.local).toBe(0);
    expect(result.local).toContain('local-only-direct-write');
    expect(result.local).toContain('local-only-child-output');
    expect(result.local).toContain('ER_LOCK_DEADLOCK');
    expect(result.dedicated).not.toMatch(/canary[-_]|local-only|application.unhandled/);
    const records = result.dedicated
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
    expect(records.map((r) => r.event)).toEqual([
        'database.query.failed',
        'http.response',
        'database.query.slow',
        'http.response',
    ]);
    expect(records[1]).toMatchObject({ service: 'api', method: 'POST', status: 500 });
    expect(records[3]).not.toHaveProperty('method');
    expect(records[3]).not.toHaveProperty('elapsedMs');
});

it('does not write to an inherited descriptor without the dedicated sink opt-in', () => {
    const result = run(
        path.resolve(import.meta.dirname, '../fixtures/backend-log-probe.mjs'),
        false,
    );
    expect(result.status).toBe(0);
    expect(result.dedicated).toBe('');
    expect(result.local).toContain('database.query.failed');
});

describe.skipIf(!process.env.STAM_BACKEND_LOG_SMOKE)('compiled entries', () => {
    it('rotates Mollie credentials and submits Buckaroo payments without logging provider data', async () => {
        const organization = await new OrganizationFactory({}).create();
        const initial = new MollieToken();
        initial.organizationId = organization.id;
        initial.accessToken = 'canary-old-access';
        initial.refreshToken = 'canary-old-refresh';
        initial.expiresOn = new Date(Date.now() - 1000);
        await initial.save();
        const result = run(
            path.resolve(import.meta.dirname, '../fixtures/provider-log-probe.mjs'),
            true,
            [organization.id],
        );
        expect(result.status, result.local).toBe(0);
        const [stored] = await MollieToken.where({ organizationId: organization.id });
        expect(stored.accessToken).toBe('canary-rotated-access');
        expect(stored.refreshToken).toBe('canary-rotated-refresh');
        expect(result.local + result.dedicated).not.toMatch(/canary-|192\.0\.2\.77|7345\.67/);
        expect(JSON.parse(result.dedicated)).toMatchObject({
            service: 'api',
            event: 'worker.failed',
        });
    });
    it('keeps mail, payment and signing details out of both sinks', () => {
        const result = run(
            path.resolve(import.meta.dirname, '../fixtures/mail-payment-log-probe.mjs'),
        );
        expect(result.status, result.local).toBe(0);
        expect(result.local).toContain('File signing is disabled');
        expect(result.local).toContain('4743e3d6-1690-41d9-aba5-f7e13735ae47');
        expect(result.dedicated).not.toContain('4743e3d6-1690-41d9-aba5-f7e13735ae47');
        expect(result.local).not.toMatch(/canary-|987654321|1234567|"d"\s*:/);
        expect(result.dedicated).not.toMatch(/canary-|987654321|1234567|"d"\s*:/);
        expect(JSON.parse(result.dedicated)).toMatchObject({
            service: 'api',
            event: 'worker.failed',
        });
    });
    it('keeps verification tokens, duplicate parent details and signed Stripe payloads out of both sinks', () => {
        const result = run(
            path.resolve(import.meta.dirname, '../fixtures/sensitive-branches-probe.mjs'),
        );
        expect(result.status, result.local).toBe(0);
        expect(result.local).not.toContain('canary-');
        expect(result.local).toContain('charge.updated');
        expect(result.dedicated).not.toContain('canary-');
        expect(JSON.parse(result.dedicated)).toMatchObject({
            service: 'api',
            event: 'worker.failed',
        });
    });
    it.each(['api', 'renderer', 'backup', 'redirecter', 'statistics-syncer'])(
        'writes a fixed startup failure from the compiled %s process',
        (service) => {
            const result = run(
                path.resolve(import.meta.dirname, '../../..', service, 'dist/index.js'),
            );
            expect(result.status).toBe(1);
            expect(result.local).toContain('Fatal backend exception');
            expect(result.local + result.dedicated).not.toContain('canary');
            expect(JSON.parse(result.dedicated)).toMatchObject({
                service,
                level: 'error',
                event: 'application.startup.failed',
            });
        },
    );
});

for (const mode of ['both', 'local', 'off'])
    it(`matches dedicated response logs to decoded provider spans: ${mode}`, () => {
        const result = run(
            path.resolve(import.meta.dirname, '../fixtures/trace-log-correlation.mjs'),
            true,
            [mode],
        );
        expect(result.status, result.local).toBe(0);
        expect(result.local).not.toMatch(/"(?:span_id|trace_id)":/);
        expect(result.dedicated).not.toMatch(/private|aaaaaaa|bbbbbbb/);
    });
