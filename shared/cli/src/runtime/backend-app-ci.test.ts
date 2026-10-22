import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const aggregate = workflow.split('    job_test_backend_apps:\n')[1].split('    job_test_backend_shared:\n')[0];
const checkShards = aggregate.split('              run: |\n')[1].replace(/^ {18}/gm, '');

describe('backend app CI aggregation', () => {
    it('preserves the required check name and evaluates failed or skipped shards', () => {
        expect(aggregate).toContain('name: "Backend App Tests"');
        expect(aggregate).toContain('needs: [job_setup, job_test_backend_app_shards]');
        expect(aggregate).toContain('!cancelled()');
        expect(aggregate).toContain("needs.job_setup.outputs.changed_backend_apps == 'true'");
    });

    it('accepts a successful matrix', () => {
        expect(() => check('success')).not.toThrow();
    });

    it.each(['failure', 'cancelled', 'skipped', ''])('rejects matrix result %s', (result) => {
        expect(() => check(result)).toThrow();
    });
});

function check(result: string) {
    execFileSync('bash', ['-e', '-o', 'pipefail', '-c', checkShards], {
        env: { ...process.env, SHARD_RESULT: result },
    });
}
