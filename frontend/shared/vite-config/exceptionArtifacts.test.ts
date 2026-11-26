import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { SourceMap } from 'node:module';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { expect, it } from 'vitest';
import { exceptionArtifacts } from './exceptionArtifacts.ts';

it('keeps maps outside distributable assets and resolves real generated coordinates using the private map', async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'errors-build-'));
    try {
        const root = path.join(tmp, 'app');
        const privateRoot = path.join(tmp, 'maps');
        mkdirSync(root);
        mkdirSync(privateRoot, { mode: 0o700 });
        writeFileSync(path.join(root, 'entry.js'), [
            'export function one() { throw new TypeError("canary-one"); }',
            'export function two() { throw new TypeError("canary-two"); }',
            'export function lookup(url) { return __STAM_OWNED_EXCEPTION_ARTIFACT__(url); }',
        ].join('\n'));
        await build({ root, configFile: false, logLevel: 'silent',
            plugins: [exceptionArtifacts({ privateRoot, release: 'a'.repeat(40) })],
            build: { lib: { entry: path.join(root, 'entry.js'), formats: ['es'], fileName: () => 'app.mjs' } },
        });
        const dist = path.join(root, 'dist');
        expect(readdirSync(dist)).toEqual(['app.mjs']);
        const file = path.join(dist, 'app.mjs');
        const code = readFileSync(file, 'utf8');
        expect(code).not.toContain('sourceMappingURL');
        const url = pathToFileURL(file).href;
        // Use the shipped file, not Vitest's transformed module or stack formatter.
        const { artifact, envelopes, foreign } = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
            import { projectExceptionEvent } from '@common/errors';
            import { createRequire } from 'node:module';
            const require = createRequire(process.cwd() + '/../../../backend/shared/env/package.json');
            const { defaultStackParser } = require('@sentry/node');
            const url = process.argv[1], app = await import(url);
            const envelopes = [];
            for (const fn of [app.one, app.two, app.one]) {
                try { fn(); } catch (error) {
                    const frames = defaultStackParser(error.stack);
                    const event = projectExceptionEvent({ exception: { values: [{ stacktrace: { frames } }] } }, error, 'browser.vue', {}, file => app.lookup(file.startsWith('/') ? 'file://' + file : file));
                    envelopes.push(JSON.stringify(event));
                }
            }
            console.log(JSON.stringify({ artifact: app.lookup(url), envelopes, foreign: !!app.lookup("https://example.invalid/canary/app.mjs") }));
        `, url], { encoding: 'utf8', timeout: 5000, cwd: import.meta.dirname }));
        expect(foreign).toBe(false);
        const archive = path.join(privateRoot, readdirSync(privateRoot)[0]);
        expect(readFileSync(path.join(archive, `${artifact.id}.js`), 'utf8')).toContain(code);
        const map = JSON.parse(readFileSync(path.join(archive, `${artifact.id}.js.map`), 'utf8'));
        expect(map.debug_id).toBe(artifact.id);
        const decoder = new SourceMap(map);
        expect(envelopes).toHaveLength(3);
        const groups = [];
        for (const [index, envelope] of (envelopes as string[]).entries()) {
            expect(envelope).not.toContain('canary');
            expect(envelope).not.toContain(url);
            const event = JSON.parse(envelope);
            groups.push(event.fingerprint);
            const { lineno, colno, filename } = event.exception.values[0].stacktrace.frames.at(-1);
            expect(filename).toBe(`app:///${artifact.id}.js`);
            expect(decoder.findEntry(lineno - 1, colno - 1)).toMatchObject({ originalLine: index % 2 });
        }
        expect(groups[0]).toEqual(groups[2]);
        expect(groups[0]).not.toEqual(groups[1]);
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
});
