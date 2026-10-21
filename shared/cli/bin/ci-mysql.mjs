#!/usr/bin/env node

// Runs before dependencies and the compiled CLI are available on GitHub runners.
import { execFile, spawn } from 'node:child_process';
import { mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const container = 'stamhoofd-ci-mysql';
const directory = path.join(process.env.RUNNER_TEMP, container);
const statusPath = path.join(directory, 'status.json');
const logPath = path.join(directory, 'startup.log');
const timeout = 180_000;

async function docker(args, commandTimeout = 120_000) {
    console.log(`docker ${args.join(' ')}`);
    const { stdout, stderr } = await exec('docker', args, { timeout: commandTimeout });
    if (stdout) {
        console.log(stdout);
    }
    if (stderr) {
        console.error(stderr);
    }
}

async function status() {
    try {
        return JSON.parse(await readFile(statusPath, 'utf8'));
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return undefined;
        }
        throw error;
    }
}

async function start() {
    if (!process.env.CI_MYSQL_IMAGE) {
        throw new Error('CI_MYSQL_IMAGE must contain the pinned MySQL image.');
    }
    await mkdir(directory);
    const log = await open(logPath, 'w');
    try {
        const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'provision'], {
            detached: true,
            stdio: ['ignore', log.fd, log.fd],
        });
        await new Promise((resolve, reject) => {
            child.once('spawn', resolve);
            child.once('error', reject);
        });
        child.unref();
    }
    finally {
        await log.close();
    }
    console.log(`MySQL is provisioning in the background. Log: ${logPath}`);
}

async function provision() {
    const startedAt = Date.now();
    let result;
    try {
        const run = async (args) => {
            const remaining = timeout - (Date.now() - startedAt);
            if (remaining <= 0) {
                throw new Error('MySQL provisioning timed out.');
            }
            await docker(args, Math.min(120_000, remaining));
        };
        await run(['pull', process.env.CI_MYSQL_IMAGE]);
        await run(['run', '-d', '--name', container,
            '-e', 'MYSQL_ROOT_PASSWORD=root', '-e', 'MYSQL_DATABASE=stamhoofd-tests',
            '-p', '127.0.0.1:3306:3306', process.env.CI_MYSQL_IMAGE]);

        // TCP avoids accepting the entrypoint's temporary, socket-only initialization server.
        while (true) {
            try {
                await exec('docker', ['exec', container, 'mysql', '-h127.0.0.1', '-uroot', '-proot', '-e', 'SELECT 1'], { timeout: 5_000 });
                break;
            }
            catch (error) {
                if (Date.now() - startedAt >= timeout) {
                    throw new Error('MySQL did not become ready in time.', { cause: error });
                }
                await setTimeout(1000);
            }
        }
        result = { ready: true };
    }
    catch (error) {
        console.error(error);
        result = { ready: false, error: error.message };
    }
    await writeFile(`${statusPath}.tmp`, JSON.stringify(result));
    await rename(`${statusPath}.tmp`, statusPath);
}

async function wait() {
    const startedAt = Date.now();
    let result;
    while (!(result = await status())) {
        if (Date.now() - startedAt >= timeout) {
            throw new Error('Timed out waiting for background MySQL provisioning.');
        }
        await setTimeout(250);
    }
    if (!result.ready) {
        throw new Error(`MySQL provisioning failed: ${result.error}`);
    }
}

try {
    switch (process.argv[2]) {
        case 'start': await start(); break;
        case 'provision': await provision(); break;
        case 'wait': await wait(); break;
        default: throw new Error('Expected start, provision, or wait.');
    }
}
catch (error) {
    console.error(error);
    process.exitCode = 1;
}
