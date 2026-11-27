import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function run(entry: string, optIn = true, preloads: string[] = []) {
    const dir = mkdtempSync(path.join(tmpdir(), 'exception-envelope-'));
    try {
        writeFileSync(path.join(dir, '.env.json'), '{"canary-health":canary-key}');
        const preload = path.resolve(
            import.meta.dirname,
            '../fixtures/exception-envelope-sink.mjs',
        );
        const child = spawnSync(
            process.execPath,
            [
                ...(optIn ? ['--import', preload] : []),
                ...preloads.flatMap((file) => ['--import', file]),
                entry,
            ],
            {
                cwd: dir,
                env: { NODE_ENV: 'production', PATH: process.env.PATH },
                encoding: 'utf8',
                timeout: 15000,
                stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
            },
        );
        if (child.error) throw child.error;
        return {
            status: child.status,
            local: child.stdout + child.stderr,
            envelope: child.output[3],
        };
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

describe.skipIf(!process.env.STAM_BACKEND_EXCEPTION_SMOKE)('compiled exception boundaries', () => {
    it.each(['api', 'renderer', 'backup', 'redirecter', 'statistics-syncer'])(
        'preserves fatal %s exit and sends one bounded startup exception',
        (service) => {
            const result = run(
                path.resolve(import.meta.dirname, '../../..', service, 'dist/index.js'),
            );
            expect(result.status, result.local).toBe(1);
            expect(result.local + result.envelope).not.toContain('canary');
            expect(JSON.parse(result.envelope!)).toEqual({ boundary: 'backend.startup', type: 'SyntaxError' });

            const rejection = run(
                path.resolve(
                    import.meta.dirname,
                    '../../..',
                    service,
                    'dist',
                    ['renderer', 'redirecter'].includes(service) ? 'boot.js' : 'src/boot.js',
                ),
                true,
                [path.resolve(import.meta.dirname, '../fixtures/fatal-rejection-probe.mjs')],
            );
            expect(rejection.status, rejection.local).toBe(1);
            expect(rejection.local + rejection.envelope).not.toContain('canary');
            expect(rejection.local).toContain('application.unhandled');
            expect(JSON.parse(rejection.envelope!)).toEqual({ boundary: 'backend.rejection', type: 'RangeError' });
        },
    );
    it('preserves typed HTTP failures and projects only the unexpected exception before conversion', () => {
        const entry = path.resolve(import.meta.dirname, '../fixtures/request-exception-probe.mjs');
        const off = run(entry, false);
        expect(off.status, off.local).toBe(0);
        expect(off.envelope).toBe('');
        const on = run(entry);
        expect(on.status, on.local).toBe(0);
        expect(on.envelope).not.toContain('canary');
        expect(JSON.parse(on.envelope!)).toEqual({ boundary: 'backend.request', type: 'TypeError' });
    });
});
