import type { RunCaptureResult } from '../runtime/command-runner.js';
import { run, RunVerbosity } from '../runtime/command-runner.js';
import { command, confirm, success, table, warning } from '../runtime/ux.js';
import { detectVcs, Vcs } from '../runtime/vcs.js';

type Repair = { command: string; args: string[] };
type VcsCheck = { label: string; ok: boolean; details: string; repairs: Repair[] };
type VcsCommands = {
    read: (args: string[]) => Promise<RunCaptureResult>;
    repair: (...args: string[]) => Repair;
};

/**
 * Checks Git and existing JJ repositories without changing their state.
 *
 * JJ workspaces use their backing Git directory, which may be outside rootDir.
 * Git is used when JJ is unavailable or the repository is not initialized for JJ.
 * Setup never installs or initializes JJ.
 *
 * If JJ is installed but cannot read an existing JJ repository, that requires
 * manual repair rather than silently treating the repository as Git-only.
 * Results include ordered repair commands; checks never fetch, push, or initialize JJ.
 */
export async function checkVcs(rootDir: string, verbosity = RunVerbosity.Quiet): Promise<VcsCheck[]> {
    const vcs = await detectVcs(rootDir, verbosity);
    const selection: VcsCheck = { label: 'Version control', ok: true, details: `Using ${vcs}`, repairs: [] };
    let gitDir: string | undefined;
    if (vcs === Vcs.Jj) {
        const repository = await run('jj', ['--ignore-working-copy', 'git', 'root'], { cwd: rootDir, capture: true, allowFailure: true, verbosity });
        if (repository.status !== 0) {
            return [selection, { label: 'JJ repository', ok: false, details: repository.stderr.trim() || 'Cannot access the existing JJ repository', repairs: [] }];
        }
        gitDir = repository.stdout.trim();
    }
    const gitChecks = await checkGit(rootDir, verbosity, gitDir);
    if (vcs === Vcs.Git || gitChecks[0]?.label === 'Repository') {
        return [selection, ...gitChecks];
    }
    return [selection, ...gitChecks, ...await checkJj(rootDir, verbosity)];
}

/**
 * Checks Git remotes, private branch tracking, and safe push defaults.
 *
 * Validates public/private remote URLs, private branch availability and upstream,
 * and current-branch push defaults. An explicit push URL, refspec, or mirror setting
 * can override otherwise safe defaults, so these are checked separately.
 *
 * Repairs are repository-local and preserve existing branch tips and checkout:
 * remotes are repaired before fetching, and fetching precedes branch creation.
 * gitDir selects the backing repository for JJ workspaces without their own .git.
 */
async function checkGit(rootDir: string, verbosity: RunVerbosity, gitDir?: string): Promise<VcsCheck[]> {
    const gitArgs = gitDir ? [`--git-dir=${gitDir}`] : [];
    const git: VcsCommands = {
        read: args => run('git', [...gitArgs, ...args], { cwd: rootDir, capture: true, allowFailure: true, verbosity }),
        repair: (...args) => ({ command: 'git', args: [...gitArgs, ...args] }),
    };
    if ((await git.read(['rev-parse', '--git-dir'])).status !== 0) {
        return [{ label: 'Repository', ok: false, details: 'No Git repository found', repairs: [] }];
    }
    const remotes = await checkGitRemotes(git);
    return [
        ...remotes.checks,
        ...await checkGitPrivateBranch(git, remotes.privateRemoteOk),
        ...await checkGitBranchConfig(git),
    ];
}

/**
 * Checks Git remote URLs and overrides that affect push safety.
 *
 * Both fetch and push URLs must target the intended public or private repository.
 * Equivalent SSH/HTTPS URLs are accepted. Push refspecs and mirror settings are
 * checked separately because they can override current-branch push defaults.
 *
 * The private URL result also determines whether an existing remote ref can be
 * trusted. A failed URL check requires fetching after remote repairs.
 */
async function checkGitRemotes(git: VcsCommands): Promise<{ checks: VcsCheck[]; privateRemoteOk: boolean }> {
    const checks: VcsCheck[] = [];
    const add = (label: string, ok: boolean, details: string, repairs: Repair[]) => checks.push({ label, ok, details, repairs });
    let privateRemoteOk = false;
    for (const [remote, repository] of [['origin', 'stamhoofd'], ['private', 'stamhoofd-private']]) {
        const url = `git@github.com:stamhoofd/${repository}.git`;
        const fetch = await git.read(['remote', 'get-url', '--all', remote]);
        const push = await git.read(['remote', 'get-url', '--push', '--all', remote]);
        const valid = (value: string) => value.trim().split('\n').every(u => [url, `https://github.com/stamhoofd/${repository}.git`, `https://github.com/stamhoofd/${repository}`, `ssh://git@github.com/stamhoofd/${repository}.git`].includes(u));
        const ok = fetch.status === 0 && push.status === 0 && valid(fetch.stdout) && valid(push.stdout);
        if (remote === 'private') {
            privateRemoteOk = ok;
        }
        add(`${remote} remote`, ok, ok ? fetch.stdout.trim() : `Expected ${url} for fetch and push`, fetch.status !== 0
            ? [git.repair('remote', 'add', remote, url)]
            : [git.repair('config', '--local', '--replace-all', `remote.${remote}.url`, url), git.repair('config', '--local', '--replace-all', `remote.${remote}.pushurl`, url)]);
        for (const key of [`remote.${remote}.push`, `remote.${remote}.mirror`]) {
            const value = await git.read(['config', '--get-all', key]);
            const ok = value.status === 1 || value.stdout.trim() === (key.endsWith('.mirror') ? 'false' : 'HEAD');
            add(key, ok, ok ? 'No unsafe push override' : 'Explicit push refspec or mirror overrides safe defaults', [git.repair('config', '--local', '--replace-all', key, key.endsWith('.mirror') ? 'false' : 'HEAD')]);
        }
    }
    return { checks, privateRemoteOk };
}

/**
 * Checks whether the remote and local private branches are available.
 *
 * A remote ref is not trusted when the private URL needs repair: it may have been
 * fetched from the wrong repository. Fetch repairs precede local branch creation.
 * Existing local branch tips are preserved; missing branches are created without
 * switching checkout.
 */
async function checkGitPrivateBranch(git: VcsCommands, privateRemoteOk: boolean): Promise<VcsCheck[]> {
    const remoteBranch = await git.read(['show-ref', '--verify', '--quiet', 'refs/remotes/private/private']);
    const remoteBranchOk = remoteBranch.status === 0 && privateRemoteOk;
    const localBranch = await git.read(['show-ref', '--verify', '--quiet', 'refs/heads/private']);
    return [
        {
            label: 'private/private fetched',
            ok: remoteBranchOk,
            details: remoteBranchOk ? 'Remote branch available' : 'Fetch private branch',
            repairs: [git.repair('fetch', 'private', '+refs/heads/private:refs/remotes/private/private')],
        },
        {
            label: 'private branch',
            ok: localBranch.status === 0,
            details: localBranch.status === 0 ? 'Local branch exists' : 'Create private without switching checkout',
            repairs: [git.repair('branch', '--track', 'private', 'private/private')],
        },
    ];
}

/**
 * Checks Git branch tracking and current-branch push configuration.
 *
 * The private branch tracks private/private and pushes to private; main pushes to
 * origin. Repairs change repository-local configuration, not branch positions.
 */
async function checkGitBranchConfig(git: VcsCommands): Promise<VcsCheck[]> {
    const checks: VcsCheck[] = [];
    for (const [key, expected] of [
        ['branch.private.remote', 'private'], ['branch.private.merge', 'refs/heads/private'],
        ['branch.private.pushRemote', 'private'], ['branch.main.pushRemote', 'origin'], ['push.default', 'current'],
    ]) {
        const value = await git.read(['config', '--get', key]);
        checks.push({
            label: key,
            ok: value.status === 0 && value.stdout.trim() === expected,
            details: `Expected ${expected}`,
            repairs: [git.repair('config', '--local', '--replace-all', key, expected)],
        });
    }
    return checks;
}

/**
 * Checks JJ remote defaults and bookmark tracking.
 *
 * JJ does not use Git's per-branch pushRemote settings: origin stays the default,
 * and private pushes require --remote private. Automatic tracking excludes private
 * on origin while preserving existing patterns, and only includes private on private.
 * Cross-remote tracking is removed before the intended remote is fetched and tracked.
 *
 * Conflicted or deleted local bookmarks require manual resolution instead of resetting
 * their targets. All JJ commands ignore the working copy to avoid snapshotting edits.
 */
async function checkJj(rootDir: string, verbosity: RunVerbosity): Promise<VcsCheck[]> {
    const jj: VcsCommands = {
        read: args => run('jj', ['--ignore-working-copy', ...args], { cwd: rootDir, capture: true, allowFailure: true, verbosity }),
        repair: (...args) => ({ command: 'jj', args: ['--ignore-working-copy', ...args] }),
    };
    return [
        ...await checkJjRemoteConfig(jj),
        ...await checkJjAutomaticTracking(jj),
        ...await checkJjBookmarkTracking(jj),
        ...await checkJjBookmarkPositions(jj),
    ];
}

/**
 * Checks JJ's default fetch and push remotes.
 *
 * Fetches include origin and private, but pushes default only to origin. JJ does
 * not route pushes using Git's per-branch pushRemote; private pushes stay explicit.
 */
async function checkJjRemoteConfig(jj: VcsCommands): Promise<VcsCheck[]> {
    const checks: VcsCheck[] = [];
    for (const [key, expected] of [['git.fetch', '["origin", "private"]'], ['git.push', 'origin']]) {
        const value = await jj.read(['config', 'get', key]);
        const actual = key === 'git.fetch' ? value.stdout.trim().replace(/\s/g, '') : value.stdout.trim();
        checks.push({
            label: `JJ ${key}`,
            ok: value.status === 0 && actual === expected.replace(/\s/g, ''),
            details: `Expected ${expected}`,
            repairs: [jj.repair('config', 'set', '--repo', key, expected)],
        });
    }
    return checks;
}

/**
 * Checks automatic bookmark tracking for both JJ remotes.
 *
 * The private remote only auto-tracks private. Origin excludes private while
 * retaining its existing pattern. Both fetched and locally created bookmarks
 * are covered so future commands do not reintroduce cross-remote tracking.
 */
async function checkJjAutomaticTracking(jj: VcsCommands): Promise<VcsCheck[]> {
    const checks: VcsCheck[] = [];
    for (const key of ['remotes.private.auto-track-bookmarks', 'remotes.private.auto-track-created-bookmarks']) {
        const expected = 'exact:private';
        const value = await jj.read(['config', 'get', key]);
        checks.push({
            label: `JJ ${key}`,
            ok: value.status === 0 && value.stdout.trim() === expected,
            details: `Expected ${expected}`,
            repairs: [jj.repair('config', 'set', '--repo', key, expected)],
        });
    }
    for (const key of ['remotes.origin.auto-track-bookmarks', 'remotes.origin.auto-track-created-bookmarks']) {
        const autoTrack = await jj.read(['config', 'get', key]);
        const pattern = autoTrack.stdout.trim();
        if (pattern && !pattern.endsWith(' & ~exact:private')) {
            checks.push({
                label: `JJ ${key}`,
                ok: false,
                details: 'Exclude private while preserving the existing pattern',
                repairs: [jj.repair('config', 'set', '--repo', key, `(${pattern}) & ~exact:private`)],
            });
        }
    }
    return checks;
}

/**
 * Checks the tracked remote for the main and private JJ bookmarks.
 *
 * Cross-remote tracking is removed before fetching and tracking the intended
 * remote. Tracking can expose divergent bookmark targets; no repair resets them.
 */
async function checkJjBookmarkTracking(jj: VcsCommands): Promise<VcsCheck[]> {
    const checks: VcsCheck[] = [];
    const tracked = await jj.read(['bookmark', 'list', '--tracked', '-T', 'name ++ "@" ++ remote ++ "\n"']);
    const names = tracked.stdout.trim().split('\n');
    for (const [bookmark, remote, other] of [['private', 'private', 'origin'], ['main', 'origin', 'private']]) {
        checks.push({
            label: `JJ ${bookmark}@${other}`,
            ok: tracked.status === 0 && !names.includes(`${bookmark}@${other}`),
            details: 'Must not track the other remote',
            repairs: [jj.repair('bookmark', 'untrack', `${bookmark}@${other}`)],
        });
        checks.push({
            label: `JJ ${bookmark}@${remote}`,
            ok: tracked.status === 0 && names.includes(`${bookmark}@${remote}`),
            details: `Track only ${remote}`,
            repairs: [jj.repair('git', 'fetch', '--remote', remote), jj.repair('bookmark', 'track', `${bookmark}@${remote}`)],
        });
    }
    return checks;
}

/**
 * Checks for conflicted or deleted local JJ bookmarks that need manual repair.
 *
 * A missing normal_target represents either state. No automatic repair is offered
 * because choosing a target could discard existing bookmark positions.
 */
async function checkJjBookmarkPositions(jj: VcsCommands): Promise<VcsCheck[]> {
    const bookmarks = await jj.read(['bookmark', 'list', 'private', 'main', '-T', 'name ++ "\t" ++ if(normal_target, "ok", "conflict") ++ "\n"']);
    const conflicts = bookmarks.stdout.trim().split('\n').filter(line => line.endsWith('\tconflict'));
    return [{
        label: 'JJ bookmark positions',
        ok: bookmarks.status === 0 && conflicts.length === 0,
        details: conflicts.length ? `Resolve conflicted or deleted bookmarks manually: ${conflicts.map(line => line.split('\t')[0]).join(', ')}` : 'Existing bookmark positions preserved',
        repairs: [],
    }];
}

/**
 * Previews and applies approved VCS repairs, then rechecks the repository.
 *
 * Displays checks and proposed repairs and obtains approval unless yes is set.
 * Repairs run in dependency order before rechecking. dryRun only previews.
 * Manual blockers prevent all repairs; command failures stop subsequent repairs.
 *
 * Setup never pushes, switches checkout, or resets existing branches/bookmarks.
 * Server-side restrictions remain necessary because explicit push arguments can
 * bypass these defaults.
 */
export async function setupVcs(rootDir: string, options: { yes: boolean; dryRun: boolean; verbosity?: RunVerbosity }): Promise<void> {
    const checks = await checkVcs(rootDir, options.verbosity);
    table(['Check', 'Status', 'Details'], checks.map(check => [check.label, check.ok ? 'ready' : 'missing', check.details]), { title: 'Version control setup' });
    const missing = checks.filter(check => !check.ok);
    const repairs = missing.flatMap(check => check.repairs);
    for (const repair of repairs) {
        console.log(command([repair.command, ...repair.args].map(arg => JSON.stringify(arg)).join(' ')));
    }
    if (options.dryRun) {
        warning('Dry run: version control was not changed.');
        return;
    }
    if (missing.some(check => check.repairs.length === 0)) {
        throw new Error('Resolve the repository setup problem above first.');
    }
    if (repairs.length && !options.yes && !(await confirm('Apply these version control fixes?', { default: true }))) {
        return;
    }
    for (const repair of repairs) {
        await run(repair.command, repair.args, { cwd: rootDir, verbosity: options.verbosity ?? RunVerbosity.Output });
    }
    const remaining = (await checkVcs(rootDir, options.verbosity)).filter(check => !check.ok);
    if (remaining.length) {
        throw new Error(`Version control checks still failing: ${remaining.map(check => check.label).join(', ')}`);
    }
    success('Version control configured. JJ private pushes require: jj git push --remote private --bookmark private');
}
