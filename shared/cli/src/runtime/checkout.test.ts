import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertMainCheckout, assertReleaseTag, inspectCheckout } from './checkout.js';

for (const vcs of ['git', 'jj'] as const) {
    describe.skipIf(vcs === 'jj' && spawnSync('jj', ['--version']).status !== 0)(
        `${vcs} checkout validation`,
        () => {
            let root: string;
            let cwd: string;
            const command = (name: string, args: string[]) =>
                execFileSync(name, args, {
                    cwd,
                    encoding: 'utf8',
                    stdio: ['ignore', 'pipe', 'pipe'],
                }).trim();

            beforeEach(async () => {
                root = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-checkout-'));
                cwd = path.join(root, 'checkout');
                await fs.mkdir(cwd);
                command('git', ['init', '--bare', path.join(root, 'origin')]);
                command('git', ['init', '-b', 'main']);
                command('git', ['config', 'user.name', 'Test']);
                command('git', ['config', 'user.email', 'test@example.org']);
                command('git', ['config', 'commit.gpgsign', 'false']);
                await fs.writeFile(path.join(cwd, 'file'), 'released\n');
                command('git', ['add', 'file']);
                command('git', ['commit', '-m', 'Release']);
                command('git', ['tag', 'v1.0.0']);
                command('git', ['remote', 'add', 'origin', path.join(root, 'origin')]);
                command('git', ['push', '-u', 'origin', 'main']);
                if (vcs === 'jj') {
                    command('jj', ['git', 'init', '--colocate']);
                }
            });

            afterEach(async () => {
                await fs.rm(root, { recursive: true, force: true });
            });

            it('accepts synchronized main and its release tag', async () => {
                expect(await inspectCheckout(cwd)).toMatchObject({ vcs, clean: true });
                await expect(assertMainCheckout(cwd)).resolves.toBeUndefined();
                await expect(assertReleaseTag(cwd, 'v1.0.0')).resolves.toBeUndefined();
            });

            it('rejects unsnapshotted edits and untracked files', async () => {
                for (const file of ['file', 'untracked']) {
                    await fs.writeFile(path.join(cwd, file), 'pending\n');
                    await expect(assertMainCheckout(cwd)).rejects.toThrow('pending changes');
                    await expect(assertReleaseTag(cwd, 'v1.0.0')).rejects.toThrow(
                        'pending changes',
                    );
                    await fs.writeFile(path.join(cwd, 'file'), 'released\n');
                }
            });

            it('rejects the wrong release tag', async () => {
                await expect(assertReleaseTag(cwd, 'v2.0.0')).rejects.toThrow(
                    'does not match release tag',
                );
            });

            it('accepts a tagged checkout away from main only for deployment', async () => {
                if (vcs === 'jj') {
                    command('jj', ['new', '-m', 'Another commit']);
                    command('jj', ['bookmark', 'set', 'main', '-r', '@']);
                    command('jj', ['new', 'tags()']);
                } else {
                    command('git', ['checkout', '--detach', 'v1.0.0']);
                }
                await expect(assertMainCheckout(cwd)).rejects.toThrow('not on main');
                await expect(assertReleaseTag(cwd, 'v1.0.0')).resolves.toBeUndefined();
            });

            it('rejects main ahead of origin', async () => {
                if (vcs === 'jj') {
                    command('jj', ['describe', '-m', 'Unpublished']);
                    command('jj', ['bookmark', 'set', 'main', '-r', '@']);
                    command('jj', ['new']);
                } else {
                    command('git', ['commit', '--allow-empty', '-m', 'Unpublished']);
                }
                await expect(assertMainCheckout(cwd)).rejects.toThrow('not up to date');
            });
        },
    );
}
