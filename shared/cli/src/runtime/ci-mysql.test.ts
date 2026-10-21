import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const exec = promisify(execFile);
const root = new URL('../../../../', import.meta.url);
const script = new URL('shared/cli/bin/ci-mysql.mjs', root);
const image = 'mysql:8.4@sha256:test';
let directory: string;
let env: NodeJS.ProcessEnv;
let started: boolean;

async function run(command: string) {
    if (command === 'start') {
        started = true;
    }
    return await exec(process.execPath, [script.pathname, command], { env, timeout: 20_000 });
}

async function calls(): Promise<string[][]> {
    try {
        const content = (await readFile(path.join(directory, 'calls'), 'utf8')).trim();
        return content ? content.split('\n').map(line => JSON.parse(line)) : [];
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

describe('CI MySQL bootstrap', () => {
    beforeEach(async () => {
        started = false;
        directory = await mkdtemp(path.join(os.tmpdir(), 'stam-ci-mysql-'));
        env = {
            ...process.env,
            RUNNER_TEMP: directory,
            PATH: `${directory}:${process.env.PATH}`,
            CI_MYSQL_IMAGE: image,
        };
        await writeFile(path.join(directory, 'docker'), `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const file = name => path.join(process.env.RUNNER_TEMP, name);
fs.appendFileSync(file('calls'), JSON.stringify(args) + '\\n');
if (args[0] === 'pull' && process.env.TEST_MYSQL_MODE === 'fail-pull') {
    console.error('Registry unavailable');
    process.exit(1);
}
if (args[0] === 'run' && process.env.TEST_MYSQL_MODE === 'fail-run') {
    console.error('Container creation failed');
    process.exit(1);
}
if (process.env.TEST_MYSQL_MODE === 'slow-' + args[0]) {
    const timer = setInterval(() => {
        if (fs.existsSync(file('release'))) {
            clearInterval(timer);
        }
    }, 20);
}
if (args[0] === 'exec' && !fs.existsSync(file('queried'))) {
    fs.writeFileSync(file('queried'), '');
    process.exit(1);
}
`, { mode: 0o755 });
    });

    afterEach(async () => {
        await writeFile(path.join(directory, 'release'), '');
        try {
            if (started) {
                await run('wait').catch(() => undefined);
            }
        }
        finally {
            await rm(directory, { recursive: true, force: true });
        }
    });

    it('returns before provisioning finishes and waits for an authenticated TCP query', async () => {
        env.TEST_MYSQL_MODE = 'slow-pull';
        expect((await run('start')).stdout).toContain('provisioning in the background');
        await expect.poll(async () => (await calls()).some(args => args[0] === 'pull')).toBe(true);
        expect((await calls()).some(args => args[0] === 'run')).toBe(false);

        await writeFile(path.join(directory, 'release'), '');
        await run('wait');
        const commands = await calls();
        expect(commands[0]).toEqual(['pull', image]);
        expect(commands.find(args => args[0] === 'run')).toEqual([
            'run', '-d', '--name', 'stamhoofd-ci-mysql',
            '-e', 'MYSQL_ROOT_PASSWORD=root', '-e', 'MYSQL_DATABASE=stamhoofd-tests',
            '-p', '127.0.0.1:3306:3306', image,
        ]);
        expect(commands.filter(args => args[0] === 'exec')).toEqual(Array(2).fill([
            'exec', 'stamhoofd-ci-mysql', 'mysql', '-h127.0.0.1', '-uroot', '-proot', '-e', 'SELECT 1',
        ]));
        expect(JSON.parse(await readFile(path.join(directory, 'stamhoofd-ci-mysql/status.json'), 'utf8')).ready).toBe(true);
    });

    it.each(['fail-pull', 'fail-run'])('propagates %s failures', async (mode) => {
        env.TEST_MYSQL_MODE = mode;
        await run('start');
        await expect(run('wait')).rejects.toThrow('MySQL provisioning failed');
    });

    it('launches before dependency setup and relies on hosted runner teardown', async () => {
        const workflow = await readFile(new URL('.github/workflows/ci.yml', root), 'utf8');
        const job = workflow.split('    job_test_playwright_shards:')[1].split('    job_test_playwright:')[0];
        expect(job).not.toContain('        services:');
        expect(job).toContain('runs-on: ubuntu-latest');
        expect(job.indexOf('ci-mysql.mjs start')).toBeLessThan(job.indexOf('uses: ./.github/actions/setup'));
        expect(job.indexOf('name: Compile API test helpers')).toBeLessThan(job.indexOf('ci-mysql.mjs wait'));
        expect(job.indexOf('ci-mysql.mjs wait')).toBeLessThan(job.indexOf('name: Run Playwright tests'));
        expect(job).not.toContain('ci-mysql.mjs stop');
    });
});
