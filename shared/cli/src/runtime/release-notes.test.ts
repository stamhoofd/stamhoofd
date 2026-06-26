import { afterEach, describe, expect, it, vi } from 'vitest';
import { run } from './command-runner.js';
import type { Commit } from './release-notes.js';
import {
    buildReleaseNotes,
    collectReleaseCommits,
    getPreviousVersionTag,
    getRefDate,
    groupCommits,
    isDependencyCommit,
    parseEmojiCommit,
    renderReleaseNotes,
} from './release-notes.js';

vi.mock('./command-runner.js', () => ({
    run: vi.fn(),
}));

const SEP = '\x1f';

/** Builds a git log line in the "%h\x1f%an\x1f%ae\x1f%s" format the collector expects. */
function logLine(hash: string, subject: string, author = 'Simon Backx', email = 'simon@stamhoofd.be'): string {
    return [hash, author, email, subject].join(SEP);
}

function gitLog(lines: string[]): { stdout: string; stderr: string; status: number } {
    return { stdout: lines.join('\n'), stderr: '', status: 0 };
}

/** Routes mocked git/gh calls by subcommand so date, login and log can be controlled per test. */
function mockGit(handlers: { log?: string[]; tagDate?: string; logins?: Record<string, string> }): void {
    vi.mocked(run).mockImplementation((async (command: string, args: string[]) => {
        if (command === 'gh') {
            const tsv = Object.entries(handlers.logins ?? {}).map(([sha, login]) => `${sha}\t${login}`).join('\n');
            return gitLog([tsv]);
        }
        if (args[0] === 'rev-parse') {
            return gitLog(['headfullsha0000000000000000000000000000']);
        }
        if (args[0] === 'for-each-ref') {
            return gitLog([handlers.tagDate ?? '']);
        }
        return gitLog(handlers.log ?? []);
    }) as never);
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('parseEmojiCommit', () => {
    it('extracts a single-codepoint emoji and the remaining text', () => {
        expect(parseEmojiCommit('🐛 Fixed a crash')).toEqual({ emoji: '🐛', description: 'Fixed a crash' });
    });

    it('handles ZWJ emoji sequences as a single grapheme', () => {
        expect(parseEmojiCommit('🧑‍💻 Improved tooling')).toEqual({ emoji: '🧑‍💻', description: 'Improved tooling' });
    });

    it('tolerates leading whitespace', () => {
        expect(parseEmojiCommit('   ✨ New thing')).toEqual({ emoji: '✨', description: 'New thing' });
    });

    it('returns null when the subject does not start with an emoji', () => {
        expect(parseEmojiCommit('Replaced translations')).toBeNull();
        expect(parseEmojiCommit('chore: release')).toBeNull();
        expect(parseEmojiCommit('')).toBeNull();
    });
});

describe('groupCommits', () => {
    it('places commits into ordered sections and collects unknown emoji under Other changes', () => {
        const commits: Commit[] = [
            { hash: 'a1', emoji: '🐛', description: 'Fix one', author: 'Alice' },
            { hash: 'a2', emoji: '✨', description: 'Feature one', author: 'Bob' },
            { hash: 'a3', emoji: '🦄', description: 'Something unusual', author: 'Carol' },
            { hash: 'a4', emoji: '🐛', description: 'Fix two', author: 'Alice' },
        ];

        const sections = groupCommits(commits);

        expect(sections.map(section => section.title)).toEqual(['✨ New', '🐛 Bug fixes', '🔖 Other changes']);
        expect(sections[1].commits.map(commit => commit.description)).toEqual(['Fix one', 'Fix two']);
        expect(sections[2].commits[0].emoji).toBe('🦄');
    });

    it('treats variation-selector emoji as equal to their base emoji', () => {
        const sections = groupCommits([{ hash: 'b1', emoji: '♻️', description: 'Refactor', author: 'Dave' }]);
        expect(sections).toHaveLength(1);
        expect(sections[0].title).toBe('♻️ Refactoring');
    });
});

describe('isDependencyCommit', () => {
    it('matches commits authored by the dependency bots', () => {
        expect(isDependencyCommit({ author: 'renovate[bot]', email: 'bot@renovateapp.com', subject: 'Update foo' })).toBe(true);
        expect(isDependencyCommit({ author: 'dependabot[bot]', email: '49699333+dependabot[bot]@users.noreply.github.com', subject: 'whatever' })).toBe(true);
    });

    it('matches the conventional subjects those bots use', () => {
        expect(isDependencyCommit({ subject: 'chore(deps): update dependency vite to v5' })).toBe(true);
        expect(isDependencyCommit({ subject: 'build(deps-dev): bump eslint from 9.0.0 to 9.1.0' })).toBe(true);
        expect(isDependencyCommit({ subject: 'Update dependency typescript to v6' })).toBe(true);
        expect(isDependencyCommit({ subject: 'Bump axios from 1.6.0 to 1.7.0' })).toBe(true);
    });

    it('does not match regular commits from humans', () => {
        expect(isDependencyCommit({ author: 'Simon Backx', email: 'simon@stamhoofd.be', subject: 'Replaced translations' })).toBe(false);
        expect(isDependencyCommit({ subject: 'Update the onboarding copy' })).toBe(false);
    });
});

describe('collectReleaseCommits', () => {
    it('parses git log output and skips commits without a leading emoji', async () => {
        vi.mocked(run).mockResolvedValue(gitLog([
            logLine('7783583', 'v2.124.0'),
            logLine('4f1c7e9', '✨ Renamed verkopen tab to webshops'),
            logLine('8d92a1a', '🐛 Fixed permission migration'),
            logLine('b9783ca', 'Replaced translations'),
        ]) as never);

        const commits = await collectReleaseCommits('/repo', { from: 'v2.123.2', to: 'v2.124.0' });

        expect(commits).toEqual([
            { hash: '4f1c7e9', emoji: '✨', description: 'Renamed verkopen tab to webshops', author: 'Simon Backx' },
            { hash: '8d92a1a', emoji: '🐛', description: 'Fixed permission migration', author: 'Simon Backx' },
        ]);

        const [, args] = vi.mocked(run).mock.calls[0];
        expect(args).toContain('v2.123.2..v2.124.0');
    });

    it('includes dependency-bot commits even without an emoji and groups them under Dependencies', async () => {
        vi.mocked(run).mockResolvedValue(gitLog([
            logLine('dep1aaa', 'Update dependency vite to v5', 'renovate[bot]', 'bot@renovateapp.com'),
            logLine('dep2bbb', 'Bump axios from 1.6.0 to 1.7.0', 'dependabot[bot]', '49699333+dependabot[bot]@users.noreply.github.com'),
            logLine('reg3ccc', 'Just some refactor without emoji'),
        ]) as never);

        const commits = await collectReleaseCommits('/repo', { from: 'v1.0.0', to: 'HEAD' });

        expect(commits).toEqual([
            { hash: 'dep1aaa', emoji: '⬆', description: 'Update dependency vite to v5', author: 'renovate[bot]' },
            { hash: 'dep2bbb', emoji: '⬆', description: 'Bump axios from 1.6.0 to 1.7.0', author: 'dependabot[bot]' },
        ]);
        expect(groupCommits(commits)[0].title).toBe('⬆️ Dependencies');
    });

    it('uses the bare ref as range when no from is provided', async () => {
        vi.mocked(run).mockResolvedValue(gitLog([]) as never);
        await collectReleaseCommits('/repo', { to: 'HEAD' });
        const [, args] = vi.mocked(run).mock.calls[0];
        expect(args).toContain('HEAD');
        expect(args.some(arg => arg.includes('..'))).toBe(false);
    });
});

describe('getPreviousVersionTag', () => {
    it('returns the tag released right before the given one', async () => {
        vi.mocked(run).mockResolvedValue(gitLog(['v2.124.0', 'v2.123.2', 'v2.123.1']) as never);
        expect(await getPreviousVersionTag('/repo', 'v2.124.0')).toBe('v2.123.2');
    });

    it('falls back to the newest tag when the given tag is not yet created', async () => {
        vi.mocked(run).mockResolvedValue(gitLog(['v2.124.0', 'v2.123.2']) as never);
        expect(await getPreviousVersionTag('/repo', 'v2.125.0')).toBe('v2.124.0');
    });

    it('returns undefined when there is no earlier tag', async () => {
        vi.mocked(run).mockResolvedValue(gitLog(['v2.124.0']) as never);
        expect(await getPreviousVersionTag('/repo', 'v2.124.0')).toBeUndefined();
    });
});

describe('getRefDate', () => {
    it('uses the tag creation date when the ref is a tag', async () => {
        mockGit({ tagDate: '2026-06-26' });
        expect(await getRefDate('/repo', 'v2.124.0')).toBe('2026-06-26');
        // The tag date short-circuits, so the commit-date fallback is never queried.
        expect(vi.mocked(run).mock.calls.some(([, args]) => args.includes('-1'))).toBe(false);
    });

    it('falls back to the commit date for non-tag refs such as HEAD', async () => {
        vi.mocked(run).mockImplementation((async (_command: string, args: string[]) => {
            if (args[0] === 'for-each-ref') {
                return gitLog(['']); // no matching tag
            }
            return gitLog(['2026-06-20']); // git log -1 --format=%cs
        }) as never);

        expect(await getRefDate('/repo', 'HEAD')).toBe('2026-06-20');
    });
});

describe('renderReleaseNotes', () => {
    it('renders the tag date, sections and a compare link', async () => {
        mockGit({
            tagDate: '2026-06-26',
            log: [
                logLine('a1', '✨ Added filters', 'Alice'),
                logLine('a2', '🐛 Fixed crash', 'Bob'),
            ],
        });

        const notes = await buildReleaseNotes('/repo', { from: 'v2.123.2', to: 'v2.124.0' });
        const markdown = renderReleaseNotes(notes, { repositorySlug: 'stamhoofd/stamhoofd' });

        expect(markdown).toContain('_Released on June 26, 2026_');
        expect(markdown).toContain('### ✨ New');
        expect(markdown).toContain('- Added filters (a1) — Alice');
        expect(markdown).toContain('### 🐛 Bug fixes');
        expect(markdown).toContain('- Fixed crash (a2) — Bob');
        expect(markdown).toContain('**Full changelog**: https://github.com/stamhoofd/stamhoofd/compare/v2.123.2...v2.124.0');
    });

    it('uses the resolved GitHub @login as a clickable mention', async () => {
        mockGit({
            tagDate: '2026-06-26',
            log: [
                logLine('4f1c7e9', '✨ Added filters', 'Simon Backx'),
                logLine('8cc4c6c', '🐛 Fixed crash', 'Benjamin De Letter'),
            ],
            logins: {
                '4f1c7e9deadbeefcafe1234567890abcdef012': 'SimonBackx',
                // 8cc4c6c intentionally has no login (e.g. author not on GitHub).
            },
        });

        const notes = await buildReleaseNotes('/repo', { from: 'v2.123.2', to: 'v2.124.0', repositorySlug: 'stamhoofd/stamhoofd' });
        const markdown = renderReleaseNotes(notes, { repositorySlug: 'stamhoofd/stamhoofd' });

        expect(markdown).toContain('- Added filters (4f1c7e9) — @SimonBackx');
        // Falls back to the plain author name when the login cannot be resolved.
        expect(markdown).toContain('- Fixed crash (8cc4c6c) — Benjamin De Letter');
    });

    it('keeps the emoji prefix for Other changes entries', () => {
        const markdown = renderReleaseNotes({
            to: 'v1.0.0',
            commits: [],
            sections: groupCommits([{ hash: 'c1', emoji: '🦄', description: 'Magic', author: 'Carol' }]),
        });
        expect(markdown).toContain('- 🦄 Magic (c1) — Carol');
    });

    it('shows a placeholder when there are no emoji commits', () => {
        const markdown = renderReleaseNotes({ to: 'HEAD', commits: [], sections: [] });
        expect(markdown.trim()).toBe('_No notable changes._');
    });
});
