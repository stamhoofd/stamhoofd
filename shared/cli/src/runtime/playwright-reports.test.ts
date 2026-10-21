import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const publisher = fileURLToPath(new URL('../../../../tests/playwright/scripts/publish-traces.sh', import.meta.url));

describe('aggregated Playwright trace publishing', () => {
    let directory: string;

    beforeEach(async () => {
        directory = await mkdtemp(path.join(os.tmpdir(), 'playwright-reports-test-'));
    });

    afterEach(async () => {
        await rm(directory, { recursive: true, force: true });
    });

    it('collects traces from separate shard artifact directories into one notification', async () => {
        for (const shard of [1, 2]) {
            const traceDirectory = path.join(directory, 'test-results', `playwright-traces-${shard}`, 'test-results', 'same-test');
            await mkdir(traceDirectory, { recursive: true });
            await writeFile(path.join(traceDirectory, 'trace.zip'), 'trace');
        }

        publish();

        const comment = await readFile(path.join(directory, 'pr-comment.md'), 'utf8');
        expect(comment.match(/<!-- playwright-traces -->/g)).toHaveLength(1);
        expect(comment).toContain('2 trace file(s) found but Spaces credentials are not configured');
        expect(await readFile(path.join(directory, 'slack-links.txt'), 'utf8')).toContain('2 trace file(s)');
    });

    it('still produces a notification when a shard failed before creating traces', async () => {
        publish();

        expect(await readFile(path.join(directory, 'pr-comment.md'), 'utf8')).toContain('No trace files were generated');
        expect(await readFile(path.join(directory, 'slack-links.txt'), 'utf8')).toContain('No trace files were generated');
    });

    function publish() {
        execFileSync('bash', [publisher], {
            cwd: directory,
            env: { ...process.env, RUNNER_TEMP: directory, SPACES_CI_BUCKET: '', SPACES_CI_REGION: '', AWS_ACCESS_KEY_ID: '', AWS_SECRET_ACCESS_KEY: '' },
        });
    }
});
