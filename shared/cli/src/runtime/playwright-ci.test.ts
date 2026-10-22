import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const checkShards = workflow.split('            - name: Check all Playwright shards succeeded\n')[1]
    .split('              run: |\n')[1].split('            - name:')[0].replace(/^ {18}/gm, '');
const hasPlaywright = workflow.match(/^\s*(has_playwright\(\).*)$/m)![1];

describe('Playwright CI aggregation', () => {
    let directory: string;

    beforeEach(async () => {
        directory = await mkdtemp(path.join(os.tmpdir(), 'playwright-ci-test-'));
    });

    afterEach(async () => {
        await rm(directory, { recursive: true, force: true });
    });

    it('accepts four successful shard reports', async () => {
        await createReports(4);

        expect(() => check('success')).not.toThrow();
    });

    it.each(['failure', 'cancelled', 'skipped'])('fails when the matrix result is %s, even with four reports', async (result) => {
        await createReports(4);

        expect(() => check(result)).toThrow();
    });

    it.each([0, 3, 5])('rejects a successful matrix with %s reports', async (count) => {
        await createReports(count);

        expect(() => check('success')).toThrow();
    });

    it.each(['Playwright Tests', 'Playwright Tests (shard 1/4)', 'Playwright Tests (shard 4/4)'])('recognizes previous failure %s', (failed) => {
        expect(() => execFileSync('bash', ['-c', `${hasPlaywright}\nhas_playwright`], { env: { ...process.env, failed } })).not.toThrow();
    });

    it('does not force Playwright after an unrelated job failed', () => {
        expect(() => execFileSync('bash', ['-c', `${hasPlaywright}\nhas_playwright`], { env: { ...process.env, failed: 'Backend App Tests' } })).toThrow();
    });

    async function createReports(count: number) {
        const reports = path.join(directory, 'tests/playwright/blob-report');
        await mkdir(reports, { recursive: true });
        for (let shard = 1; shard <= count; shard++) {
            await writeFile(path.join(reports, `report-${shard}.zip`), 'report');
        }
    }

    function check(result: string) {
        execFileSync('bash', ['-e', '-o', 'pipefail', '-c', checkShards], { cwd: directory, env: { ...process.env, SHARD_RESULT: result } });
    }
});
