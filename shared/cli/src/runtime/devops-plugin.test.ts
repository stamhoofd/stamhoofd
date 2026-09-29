import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getOptionalDevopsPlugin } from './devops-plugin.js';

const roots: string[] = [];

afterEach(async () => {
    for (const root of roots.splice(0)) {
        await rm(root, { recursive: true, force: true });
    }
});

describe('optional devops plugin', () => {
    it('is absent when the checkout is missing or empty', async () => {
        const root = await mkdtemp(join(tmpdir(), 'stam-devops-'));
        roots.push(root);
        expect(await getOptionalDevopsPlugin(join(root, 'missing'))).toBeUndefined();
        expect(await getOptionalDevopsPlugin(root)).toBeUndefined();

        await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'devops', type: 'module', oclif: { commands: './dist-cli/commands' } }));
        const commands = join(root, 'dist-cli/commands/devops');
        await mkdir(commands, { recursive: true });
        expect(await getOptionalDevopsPlugin(root)).toBeUndefined();
    });

    it('loads commands from a populated checkout', async () => {
        const root = await mkdtemp(join(tmpdir(), 'stam-devops-'));
        roots.push(root);
        await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'devops', type: 'module', oclif: { commands: './dist-cli/commands' } }));
        const commands = join(root, 'dist-cli/commands/devops');
        await mkdir(commands, { recursive: true });
        await writeFile(join(commands, 'example.js'), `import { Command } from '${import.meta.resolve('@oclif/core')}'; export default class Example extends Command { async run() {} }`);

        const plugin = await getOptionalDevopsPlugin(root);
        expect(plugin?.commandIDs).toContain('devops:example');
    });
});
