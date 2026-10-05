import fs from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from '../runtime/command-runner.js';
import { confirm } from '../runtime/ux.js';
import { checkVcs, setupVcs } from './setup-vcs.js';

vi.mock('../runtime/command-runner.js', async original => ({ ...await original<typeof import('../runtime/command-runner.js')>(), run: vi.fn() }));
vi.mock('../runtime/ux.js', async original => ({ ...await original<typeof import('../runtime/ux.js')>(), confirm: vi.fn() }));

describe('version control setup', () => {
    let jj: boolean;
    let jjInstalled: boolean;
    let fetched: boolean;
    let branch: boolean;
    let config: Map<string, string>;
    let tracked: Set<string>;
    let jjConfig: Map<string, string>;
    let bookmarkState: string;

    beforeEach(() => {
        vi.clearAllMocks();
        jj = false;
        jjInstalled = true;
        fetched = true;
        branch = true;
        bookmarkState = 'main\tok\nprivate\tok\n';
        tracked = new Set(['main@origin', 'private@private']);
        jjConfig = new Map([['git.fetch', '["origin", "private"]'], ['git.push', 'origin'], ['remotes.private.auto-track-bookmarks', 'exact:private'], ['remotes.private.auto-track-created-bookmarks', 'exact:private']]);
        config = new Map([
            ['remote.origin.url', 'git@github.com:stamhoofd/stamhoofd.git'], ['remote.private.url', 'git@github.com:stamhoofd/stamhoofd-private.git'],
            ['branch.private.remote', 'private'], ['branch.private.merge', 'refs/heads/private'],
            ['branch.private.pushRemote', 'private'], ['branch.main.pushRemote', 'origin'], ['push.default', 'current'],
        ]);
        vi.mocked(confirm).mockResolvedValue(true);
        vi.mocked(run).mockImplementation(async (cmd, rawArgs, options) => {
            const args = rawArgs.filter(arg => arg !== '--ignore-working-copy' && !arg.startsWith('--git-dir='));
            const result = (stdout = '', status = 0) => ({ stdout, stderr: '', status });
            if (cmd === 'jj') {
                if (args[0] === '--version') return result('jj 0.45.1', jjInstalled ? 0 : 1);
                if (args.join(' ') === 'git root') return result(jj ? '/backing/.git' : '', jj ? 0 : 1);
                if (!jj) throw new Error('JJ must not be initialized');
                if (args[0] === 'config' && args[1] === 'get') return result(jjConfig.get(args[2]), jjConfig.has(args[2]) ? 0 : 1);
                if (args[0] === 'config' && args[1] === 'set') jjConfig.set(args[3], args[4]);
                else if (args[0] === 'bookmark' && args[1] === 'list') return result(args.includes('--tracked') ? [...tracked].join('\n') : bookmarkState);
                else if (args[0] === 'bookmark' && args[1] === 'track') tracked.add(args[2]);
                else if (args[0] === 'bookmark' && args[1] === 'untrack') tracked.delete(args[2]);
                else if (args[0] !== 'git' && args[0] !== 'config') throw new Error(`Unexpected JJ command: ${args.join(' ')}`);
                return result();
            }
            if (args[0] === 'rev-parse') return result('/repo/.git');
            if (args[0] === 'remote' && args[1] === 'get-url') {
                const remote = args.at(-1)!;
                const value = config.get(`remote.${remote}.${args.includes('--push') && config.has(`remote.${remote}.pushurl`) ? 'pushurl' : 'url'}`);
                return result(value, value ? 0 : 2);
            }
            if (args[0] === 'remote' && args[1] === 'add') config.set(`remote.${args[2]}.url`, args[3]);
            else if (args[0] === 'config' && args[1].startsWith('--get')) return result(config.get(args[2]), config.has(args[2]) ? 0 : 1);
            else if (args[0] === 'config') config.set(args[3], args[4]);
            else if (args[0] === 'show-ref') return result('', (args.at(-1)!.startsWith('refs/remotes') ? fetched : branch) ? 0 : 1);
            else if (args[0] === 'fetch') fetched = true;
            else if (args[0] === 'branch' && args[1] === '--track') branch = true;
            else throw new Error(`Unexpected Git command: ${args.join(' ')}`);
            return options?.capture ? result() : undefined as any;
        });
    });

    it('recognizes ready Git repositories and does not initialize JJ', async () => {
        expect((await checkVcs('/repo')).every(check => check.ok)).toBe(true);
        await setupVcs('/repo', { yes: false, dryRun: false });
        expect(confirm).not.toHaveBeenCalled();
        expect(vi.mocked(run).mock.calls.every(([, , options]) => options?.capture)).toBe(true);
    });

    it('repairs missing Git configuration in order and is idempotent', async () => {
        config.delete('remote.private.url');
        config.set('branch.private.pushRemote', 'origin');
        config.set('push.default', 'matching');
        fetched = false;
        branch = false;
        expect((await checkVcs('/repo')).some(check => !check.ok)).toBe(true);
        await setupVcs('/repo', { yes: true, dryRun: false });
        const mutations = vi.mocked(run).mock.calls.filter(([, , options]) => !options?.capture).map(([, args]) => args);
        expect(mutations.slice(0, 3)).toEqual([
            ['remote', 'add', 'private', 'git@github.com:stamhoofd/stamhoofd-private.git'],
            ['fetch', 'private', '+refs/heads/private:refs/remotes/private/private'],
            ['branch', '--track', 'private', 'private/private'],
        ]);
        expect(config.get('branch.private.pushRemote')).toBe('private');
        expect(config.get('push.default')).toBe('current');
        vi.mocked(run).mockClear();
        await setupVcs('/repo', { yes: true, dryRun: false });
        expect(vi.mocked(run).mock.calls.every(([, , options]) => options?.capture)).toBe(true);
    });

    it('repairs push URLs and unsafe push overrides without moving existing branches', async () => {
        config.set('remote.private.pushurl', 'git@github.com:stamhoofd/stamhoofd.git');
        config.set('remote.origin.mirror', 'true');
        config.set('remote.origin.push', 'refs/heads/*:refs/heads/*');
        await setupVcs('/repo', { yes: true, dryRun: false });
        expect(config.get('remote.private.pushurl')).toBe(config.get('remote.private.url'));
        expect(config.get('remote.origin.mirror')).toBe('false');
        expect(config.get('remote.origin.push')).toBe('HEAD');
        expect(vi.mocked(run).mock.calls.some(([, args]) => ['switch', 'reset', 'push'].includes(args[0]))).toBe(false);
    });

    it('accepts equivalent HTTPS URLs', async () => {
        config.set('remote.private.url', 'https://github.com/stamhoofd/stamhoofd-private.git');
        expect((await checkVcs('/repo')).every(check => check.ok)).toBe(true);
    });

    it.each([true, false])('does not mutate during dry run or declined confirmation (%s)', async (dryRun) => {
        config.set('push.default', 'matching');
        vi.mocked(confirm).mockResolvedValue(false);
        await setupVcs('/repo', { yes: false, dryRun });
        expect(config.get('push.default')).toBe('matching');
        expect(vi.mocked(run).mock.calls.every(([, , options]) => options?.capture)).toBe(true);
    });

    it('configures existing JJ repositories using their backing Git directory', async () => {
        jj = true;
        jjConfig.clear();
        jjConfig.set('remotes.origin.auto-track-bookmarks', 'alice/*');
        tracked = new Set(['main@private', 'private@origin']);
        await setupVcs('/workspace', { yes: true, dryRun: false });
        expect(jjConfig.get('git.push')).toBe('origin');
        expect(jjConfig.get('git.fetch')).toBe('["origin", "private"]');
        expect(jjConfig.get('remotes.origin.auto-track-bookmarks')).toBe('(alice/*) & ~exact:private');
        expect(tracked).toEqual(new Set(['main@origin', 'private@private']));
        expect(vi.mocked(run).mock.calls.filter(([cmd]) => cmd === 'git').every(([, args]) => args[0] === '--git-dir=/backing/.git')).toBe(true);
        expect((await checkVcs('/workspace')).every(check => check.ok)).toBe(true);
    });

    it('stops on fetch failure instead of creating a branch', async () => {
        fetched = false;
        branch = false;
        const original = vi.mocked(run).getMockImplementation()!;
        vi.mocked(run).mockImplementation(async (cmd, args, options) => {
            if (cmd === 'git' && args[0] === 'fetch') throw new Error('Access denied');
            return original(cmd, args, options);
        });
        await expect(setupVcs('/repo', { yes: true, dryRun: false })).rejects.toThrow('Access denied');
        expect(branch).toBe(false);
    });

    it('requires manual resolution for conflicting JJ bookmarks', async () => {
        jj = true;
        bookmarkState = 'private\tconflict\n';
        await expect(setupVcs('/repo', { yes: true, dryRun: false })).rejects.toThrow('Resolve the repository setup problem');
        expect(vi.mocked(run).mock.calls.every(([, , options]) => options?.capture)).toBe(true);
    });

    it('uses Git when JJ is not installed even if .jj exists', async () => {
        jjInstalled = false;
        const stat = vi.spyOn(fs, 'stat').mockResolvedValue({} as any);
        try {
            const checks = await checkVcs('/repo');
            expect(checks.every(check => check.ok)).toBe(true);
            expect(checks[0]).toMatchObject({ label: 'Version control', ok: true, details: 'Using git' });
            await expect(setupVcs('/repo', { yes: true, dryRun: false })).resolves.toBeUndefined();
        } finally {
            stat.mockRestore();
        }
    });

    it('reports repository errors when JJ is installed and .jj exists', async () => {
        const stat = vi.spyOn(fs, 'stat').mockResolvedValue({} as any);
        try {
            const checks = await checkVcs('/repo');
            expect(checks).toMatchObject([{ label: 'Version control', ok: true, details: 'Using jj' }, { label: 'JJ repository', ok: false, repairs: [] }]);
            await expect(setupVcs('/repo', { yes: true, dryRun: false })).rejects.toThrow('Resolve the repository setup problem');
        } finally {
            stat.mockRestore();
        }
    });
});
