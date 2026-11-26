import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function run(entry: string, enabled: boolean) {
    const dir = mkdtempSync(path.join(tmpdir(), 'errors-shipping-'));
    try {
        writeFileSync(path.join(dir, '.env.json'), '{"canary-member":canary-key}');
        const preload = path.resolve(
            import.meta.dirname,
            '../fixtures/exception-http-receiver.mjs',
        );
        const child = spawnSync(
            process.execPath,
            ['--enable-source-maps', '--import', preload, entry],
            {
                cwd: dir,
                timeout: 5000,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
                env: {
                    NODE_ENV: 'production',
                    PATH: process.env.PATH,
                    STAM_ERRORS_ENABLED: enabled ? '1' : '',
                    STAM_ERRORS_DSN: 'https://fixture@fixture.eu-test.betterstackdata.com/123',
                    STAM_ERRORS_BRAND: 'fixture',
                    STAM_ERRORS_RELEASE: 'a'.repeat(40),
                    STAM_ERRORS_ENVIRONMENT: 'staging',
                    OTEL_SERVICE_NAME: 'canary-untrusted',
                    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://127.0.0.1:1/v1/traces',
                },
            },
        );
        if (child.error) throw child.error;
        expect(child.status, child.stderr).toBe(1);
        expect(readdirSync(dir)).toEqual(['.env.json']);
        const bytes = child.output[3]!;
        expect(child.stdout + child.stderr + bytes).not.toContain('canary');
        if (!bytes.trim()) return [];
        return bytes
            .trim()
            .split('\n')
            .map((line) => {
                const request = JSON.parse(line);
                const uri = new URL(request.uri, 'https://fixture.invalid');
                expect(uri.pathname).toBe('/api/123/envelope/');
                expect(uri.searchParams.get('sentry_key')).toBe('fixture');
                expect(request.headers).not.toHaveProperty('cookie');
                expect(request.headers).not.toHaveProperty('referer');
                expect(request.headers).not.toHaveProperty('authorization');
                expect(request.headers).not.toHaveProperty('traceparent');
                expect(request.headers).not.toHaveProperty('baggage');
                const items = request.body.split('\n').map((item: string) => JSON.parse(item));
                expect(items).toHaveLength(3);
                expect(items[0]).toMatchObject({ event_id: items[2].event_id });
                expect(items[1]).toEqual({ type: 'event' });
                return items[2];
            });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

describe.skipIf(!process.env.STAM_BACKEND_EXCEPTION_SMOKE)('exception HTTP transport', () => {
    it('groups two mapped TS sites separately under --enable-source-maps without reading source files', () => {
        const app = mkdtempSync(path.join(tmpdir(), 'mapped-app-'));
        try {
            const entry = path.join(app, 'dist/index.js');
            mkdirSync(path.dirname(entry));
            writeFileSync(
                entry,
                [
                    'function one() { throw new TypeError("canary"); }',
                    'function two() { throw new TypeError("canary"); }',
                    `import env from ${JSON.stringify(import.meta.resolve('@stamhoofd/backend-env'))};`,
                    `import { deliverExceptionEnvelope } from ${JSON.stringify(import.meta.resolve('@common/errors'))};`,
                    `try { await env.load({ service: 'api' }); } catch {}`,
                    `for (const fn of [one, two, one]) { try { fn(); } catch (e) { await deliverExceptionEnvelope('backend.request', e); } }`,
                    'process.exit(1);',
                    '//# sourceMappingURL=index.js.map',
                ].join('\n'),
            );
            writeFileSync(
                entry + '.map',
                JSON.stringify({
                    version: 3,
                    file: 'index.js',
                    sources: ['../src/index.ts'],
                    names: [],
                    mappings: 'AAAA;AACA',
                }),
            );
            const events = run(entry, true);
            expect(events.map((e) => e.exception.values[0].stacktrace.frames.at(-1))).toEqual(
                [1, 2, 1].map((lineno) => ({
                    filename: 'app:///src/index.ts',
                    lineno,
                    colno: 1,
                    in_app: true,
                })),
            );
            expect(events[0].fingerprint).not.toEqual(events[1].fingerprint);
            expect(events[0].fingerprint).toEqual(events[2].fingerprint);
        } finally {
            rmSync(app, { recursive: true, force: true });
        }
    });
    it('waits for a fatal submission from the real executable, and stays off with a DSN alone', () => {
        const entry = path.resolve(import.meta.dirname, '../../dist/index.js');
        expect(run(entry, false)).toEqual([]);
        const events = run(entry, true);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            tags: { boundary: 'backend.startup', service: 'api', brand: 'fixture' },
            release: 'a'.repeat(40),
            environment: 'staging',
        });
        expect(events[0].exception.values[0].stacktrace.frames).toContainEqual(
            expect.objectContaining({ filename: 'app:///index.ts' }),
        );
    });
    it('separates sites and releases, admits owned coordinates only and deduplicates framework rethrows', () => {
        const events = run(
            path.resolve(import.meta.dirname, '../fixtures/exception-delivery-probe.mjs'),
            true,
        );
        expect(events).toHaveLength(9);
        expect(new Set(events.slice(0, 8).map((e) => JSON.stringify(e.fingerprint))).size).toBe(8);
        for (const event of events.slice(0, 8)) {
            expect(event.exception.values[0].stacktrace.frames).toHaveLength(1);
            const frame = event.exception.values[0].stacktrace.frames[0];
            expect(event.debug_meta.images).toEqual([
                {
                    type: 'sourcemap',
                    code_file: frame.filename,
                    debug_id: '84ef940a-247c-421a-a31c-e65c08aa6254',
                },
            ]);
        }
        expect(events[8].tags.boundary).toBe('backend.rejection');
    });
});
