import { spawnSync } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

async function fixture(devops: boolean) {
    const root = await mkdtemp(join(tmpdir(), 'stam-launcher-'));
    roots.push(root);
    await mkdir(join(root, '.development'));
    await mkdir(join(root, 'shared/cli/bin'), { recursive: true });
    await mkdir(join(root, 'bin'));
    await copyFile(new URL('../../../../.development/stam.mjs', import.meta.url), join(root, '.development/stam.mjs'));
    await writeFile(join(root, 'bin/pnpm'), `#!/usr/bin/env node
const fs = require('node:fs');
console.log(JSON.stringify(process.argv.slice(2)));
console.error('Build diagnostic');
if (process.env.BUILD_STATUS) process.exit(Number(process.env.BUILD_STATUS));
fs.writeFileSync('build-args.json', JSON.stringify(process.argv.slice(2)));
fs.mkdirSync('shared/cli/dist');
fs.writeFileSync('shared/cli/dist/ready', '');
`);
    await chmod(join(root, 'bin/pnpm'), 0o755);
    await writeFile(join(root, 'shared/cli/bin/stam.js'), `const fs = require('node:fs');
fs.accessSync('shared/cli/dist/ready');
console.log(JSON.stringify({ args: process.argv.slice(2), tasks: JSON.parse(fs.readFileSync('build-args.json', 'utf8')) }));
process.exit(Number(process.env.CLI_STATUS || 0));
`);
    if (devops) {
        await mkdir(join(root, 'devops'));
        await writeFile(join(root, 'devops/tsconfig.cli.json'), '{}');
    }
    return (env = {}) => spawnSync(process.execPath, [join(root, '.development/stam.mjs'), 'config', 'value with spaces', '--json'], {
        cwd: tmpdir(),
        encoding: 'utf8',
        env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, ...env },
    });
}

describe('repository CLI launcher', () => {
    it.each([false, true])('builds before startup and forwards arguments (devops: %s)', async (devops) => {
        const run = await fixture(devops);
        const result = run();
        expect(result.status).toBe(0);
        expect(result.stderr).toBe('');
        const { args, tasks } = JSON.parse(result.stdout) as { args: string[]; tasks: string[] };
        expect(args).toEqual(['config', 'value with spaces', '--json']);
        expect(tasks).toContain('@stamhoofd/cli#build');
        expect(tasks.includes('//#build:stam-devops')).toBe(devops);
    });

    it('stops on build failure without launching the CLI', async () => {
        const run = await fixture(false);
        const result = run({ BUILD_STATUS: '42' });
        expect(result.status).toBe(42);
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain('@stamhoofd/cli#build');
        expect(result.stderr).toContain('Build diagnostic');
    });

    it('preserves the CLI exit status', async () => {
        const run = await fixture(false);
        expect(run({ CLI_STATUS: '7' }).status).toBe(7);
    });
});
