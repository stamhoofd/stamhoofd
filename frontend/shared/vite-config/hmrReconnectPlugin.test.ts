import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import hmrReconnectPlugin from './hmrReconnectPlugin.js';

const require = createRequire(import.meta.url);

// The actual dev client shipped by the installed Vite version. Running the
// transform against this (rather than a hand-written fixture) is the whole
// point: it fails loudly if a Vite upgrade renames the internals or moves the
// reload branch, i.e. exactly the "plugin silently stopped working" case.
const viteClientPath = path.join(path.dirname(require.resolve('vite/package.json')), 'dist/client/client.mjs');
const realClient = readFileSync(viteClientPath, 'utf-8');

type TransformFn = (this: { warn: (msg: string) => void }, code: string, id: string) => string | undefined | void;

function getTransform(): TransformFn {
    const transform = hmrReconnectPlugin().transform;
    if (typeof transform !== 'function') {
        throw new Error('Expected hmrReconnectPlugin().transform to be a function');
    }
    return transform as unknown as TransformFn;
}

function runTransform(code: string, id: string, ctx: { warn: (msg: string) => void } = { warn: () => {} }): string | undefined | void {
    return getTransform().call(ctx, code, id);
}

const countReloads = (code: string) => code.match(/location\.reload\(\)/g)?.length ?? 0;
const disconnectReloadPattern = /waitForSuccessfulPing\([^)]*\);\s*location\.reload\(\);/;

describe('hmrReconnectPlugin', () => {
    it('replaces the disconnect-branch reload in the real Vite client', () => {
        // Sanity-check our assumptions about the client we are patching: the
        // identifiers we inject must already exist at module scope, and the
        // reload branch must be there to replace.
        expect(realClient).toContain('transport.connect(createHMRHandler(handleMessage))');
        expect(realClient).toMatch(disconnectReloadPattern);

        const result = runTransform(realClient, viteClientPath);

        expect(typeof result).toBe('string');
        const patched = result as string;

        // The disconnect branch now reconnects instead of reloading.
        expect(patched).toContain('transport.connect(createHMRHandler(handleMessage))');
        expect(patched).not.toMatch(disconnectReloadPattern);

        // Only the disconnect reload is touched; the error-overlay and
        // debounced full-reload branches keep their own location.reload().
        expect(countReloads(patched)).toBe(countReloads(realClient) - 1);
    });

    it('leaves non-client modules untouched', () => {
        const code = 'export const answer = 42; location.reload();';
        expect(runTransform(code, '/src/some-app-module.ts')).toBeUndefined();
    });

    it('warns and makes no change when the reload branch is missing', () => {
        const warn = vi.fn();
        const result = runTransform('const notTheClient = true;', viteClientPath, { warn });

        expect(result).toBeUndefined();
        expect(warn).toHaveBeenCalledOnce();
    });
});
