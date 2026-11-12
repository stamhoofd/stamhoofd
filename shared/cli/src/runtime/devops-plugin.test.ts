import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    getOptionalDevopsPlugin,
    getOptionalDevopsSetupChecks,
    getOptionalDocsPublishingProvider,
} from './devops-plugin.js';

const roots: string[] = [];

afterEach(async () => {
    for (const root of roots.splice(0)) {
        await rm(root, { recursive: true, force: true });
    }
});

describe('optional devops plugin', () => {
    it('loads a publishing provider only when compiled, and does not hide installed module errors', async () => {
        const root = await mkdtemp(join(tmpdir(), 'stam-devops-publishing-'));
        roots.push(root);
        expect(await getOptionalDocsPublishingProvider(root)).toBeUndefined();
        await writeFile(
            join(root, 'package.json'),
            JSON.stringify({ name: 'devops', type: 'module' }),
        );
        expect(await getOptionalDocsPublishingProvider(root)).toBeUndefined();
        await mkdir(join(root, 'dist-cli'));
        await writeFile(
            join(root, 'dist-cli/docs-publishing.js'),
            'throw new Error("installed module failed");',
        );
        await expect(getOptionalDocsPublishingProvider(root)).rejects.toThrow(
            'installed module failed',
        );
    });

    it('returns the installed publishing provider', async () => {
        const root = await mkdtemp(join(tmpdir(), 'stam-devops-publishing-'));
        roots.push(root);
        await writeFile(
            join(root, 'package.json'),
            JSON.stringify({ name: 'devops', type: 'module' }),
        );
        await mkdir(join(root, 'dist-cli'));
        await writeFile(
            join(root, 'dist-cli/docs-publishing.js'),
            'export const docsPublishingProvider = { listEnvironments: async () => [], resolve: async () => ({ registry: "registry.example.com/team" }) };',
        );
        const provider = await getOptionalDocsPublishingProvider(root);
        expect(await provider?.listEnvironments()).toEqual([]);
        expect(await provider?.resolve()).toEqual({ registry: 'registry.example.com/team' });
    });
    it('loads setup definitions only from an available compiled DevOps checkout', async () => {
        const root = await mkdtemp(join(tmpdir(), 'stam-devops-setup-'));
        roots.push(root);
        expect(await getOptionalDevopsSetupChecks(root)).toEqual([]);
        await writeFile(
            join(root, 'package.json'),
            JSON.stringify({ name: 'devops', type: 'module' }),
        );
        expect(await getOptionalDevopsSetupChecks(root)).toEqual([]);
        await mkdir(join(root, 'dist-cli'));
        await writeFile(
            join(root, 'dist-cli/setup-checks.js'),
            'export function setupChecks() { return [{ label: "OpenTofu", check: async () => ({ ok: false, details: "missing", manualFix: "install tofu" }) }]; }',
        );
        const checks = await getOptionalDevopsSetupChecks(root);
        expect(checks[0].label).toBe('OpenTofu');
        expect(await checks[0].check()).toEqual({
            ok: false,
            details: 'missing',
            manualFix: 'install tofu',
        });
    });
    it('is absent when the checkout is missing or empty', async () => {
        const root = await mkdtemp(join(tmpdir(), 'stam-devops-'));
        roots.push(root);
        expect(await getOptionalDevopsPlugin(join(root, 'missing'))).toBeUndefined();
        expect(await getOptionalDevopsPlugin(root)).toBeUndefined();

        await writeFile(
            join(root, 'package.json'),
            JSON.stringify({
                name: 'devops',
                type: 'module',
                oclif: { commands: './dist-cli/commands' },
            }),
        );
        const commands = join(root, 'dist-cli/commands/devops');
        await mkdir(commands, { recursive: true });
        expect(await getOptionalDevopsPlugin(root)).toBeUndefined();
    });

    it('loads commands from a populated checkout', async () => {
        const root = await mkdtemp(join(tmpdir(), 'stam-devops-'));
        roots.push(root);
        await writeFile(
            join(root, 'package.json'),
            JSON.stringify({
                name: 'devops',
                type: 'module',
                oclif: { commands: './dist-cli/commands' },
            }),
        );
        const commands = join(root, 'dist-cli/commands/devops');
        await mkdir(commands, { recursive: true });
        await writeFile(
            join(commands, 'example.js'),
            `import { Command } from '${import.meta.resolve('@oclif/core')}'; export default class Example extends Command { async run() {} }`,
        );

        const plugin = await getOptionalDevopsPlugin(root);
        expect(plugin?.commandIDs).toContain('devops:example');
    });
});
