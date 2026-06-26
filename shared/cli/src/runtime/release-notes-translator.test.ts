import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from './command-runner.js';
import {
    buildTranslationUserMessage,
    composeReleaseNotesBody,
    getCommitDiff,
    grepCodebase,
    loadTranslationPrompt,
    translateReleaseNotes,
} from './release-notes-translator.js';
import type { ReleaseNotes } from './release-notes.js';
import { resolveTranslationModel } from './translation/create-translation-model.js';
import type { TranslationModel, TranslationRequest } from './translation/translation-model.js';

vi.mock('./command-runner.js', () => ({
    run: vi.fn(),
}));

// The factory is unit-tested separately; here we drive composeReleaseNotesBody with a fake model.
vi.mock('./translation/create-translation-model.js', () => ({
    resolveTranslationModel: vi.fn(),
}));

afterEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.RELEASE_NOTES_AI_PROVIDER;
});

const notes: ReleaseNotes = {
    to: 'v2.124.0',
    date: '2026-06-26',
    commits: [],
    sections: [],
};

/** Records the request it receives and returns a canned Dutch translation. */
function fakeModel(translation = '## Wat is er veranderd?\n- Iets nieuws', capture?: (req: TranslationRequest) => void): TranslationModel {
    return {
        name: 'fake:test',
        translate: async (request) => {
            capture?.(request);
            return translation;
        },
    };
}

describe('getCommitDiff', () => {
    it('rejects hashes that are not hex', async () => {
        expect(await getCommitDiff('/repo', 'not a hash; rm -rf')).toBe('Invalid commit hash: not a hash; rm -rf');
        expect(run).not.toHaveBeenCalled();
    });

    it('returns the git diff for a valid hash', async () => {
        vi.mocked(run).mockResolvedValue({ stdout: 'diff --git a/x b/x', stderr: '', status: 0 } as never);
        const diff = await getCommitDiff('/repo', '4f1c7e9');
        expect(diff).toBe('diff --git a/x b/x');
        const [, args] = vi.mocked(run).mock.calls[0];
        expect(args).toEqual(['show', '--no-color', '--stat', '--patch', '4f1c7e9']);
    });

    it('reports a friendly message when git fails', async () => {
        vi.mocked(run).mockResolvedValue({ stdout: '', stderr: 'bad object', status: 128 } as never);
        expect(await getCommitDiff('/repo', 'deadbeef')).toContain('Could not load the diff for deadbeef');
    });
});

describe('getCommitDiff translation resolution', () => {
    let repo: string;

    beforeEach(async () => {
        // Each test gets a fresh repo path so the module-level nl.json cache never bleeds across tests.
        repo = await mkdtemp(join(tmpdir(), 'release-notes-locale-'));
        await mkdir(join(repo, 'shared', 'locales', 'src'), { recursive: true });
        await writeFile(
            join(repo, 'shared', 'locales', 'src', 'nl.json'),
            JSON.stringify({ '%W': 'Opslaan', '%X': 'Verwijderen' }),
            'utf8',
        );
    });

    afterEach(async () => {
        await rm(repo, { recursive: true, force: true });
    });

    it('appends the Dutch source strings for every $t() key referenced in the diff', async () => {
        vi.mocked(run).mockResolvedValue({
            stdout: "+ label: $t('%W'),\n- title: $t(`%X`),",
            stderr: '',
            status: 0,
        } as never);

        const diff = await getCommitDiff(repo, '4f1c7e9');

        expect(diff).toContain("$t('%W')");
        expect(diff).toContain('Dutch source strings (nl.json)');
        expect(diff).toContain('%W: "Opslaan"');
        expect(diff).toContain('%X: "Verwijderen"');
    });

    it('does not append a translations block when the diff references no keys', async () => {
        vi.mocked(run).mockResolvedValue({ stdout: 'diff --git a/x b/x', stderr: '', status: 0 } as never);
        expect(await getCommitDiff(repo, '4f1c7e9')).toBe('diff --git a/x b/x');
    });

    it('skips keys that are missing from nl.json', async () => {
        vi.mocked(run).mockResolvedValue({ stdout: "$t('%W') and $t('%ZZZ')", stderr: '', status: 0 } as never);
        const diff = await getCommitDiff(repo, '4f1c7e9');
        expect(diff).toContain('%W: "Opslaan"');
        // The key is echoed in the diff body, but it must not be resolved into a translation line.
        expect(diff).not.toContain('%ZZZ:');
    });
});

describe('grepCodebase', () => {
    it('rejects an empty pattern without calling git', async () => {
        expect(await grepCodebase('/repo', { pattern: '', commit: 'abc1234' })).toContain('non-empty "pattern"');
        expect(run).not.toHaveBeenCalled();
    });

    it('rejects a commit that is not a hash', async () => {
        expect(await grepCodebase('/repo', { pattern: 'foo', commit: 'HEAD; rm -rf' })).toBe('Invalid commit hash: HEAD; rm -rf');
        expect(run).not.toHaveBeenCalled();
    });

    it('passes the pattern via -e, applies options, scopes a pathspec and strips the commit prefix', async () => {
        vi.mocked(run).mockResolvedValue({ stdout: 'abc1234:src/App.vue:3:Opslaan', stderr: '', status: 0 } as never);

        const output = await grepCodebase('/repo', {
            pattern: '-Opslaan',
            commit: 'abc1234',
            ignoreCase: true,
            fixedString: true,
            wordMatch: true,
            pathspec: '*.vue',
        });

        expect(output).toBe('src/App.vue:3:Opslaan');
        const [cmd, args] = vi.mocked(run).mock.calls[0];
        expect(cmd).toBe('git');
        expect(args).toEqual(['grep', '--no-color', '-n', '-I', '-i', '-F', '-w', '-e', '-Opslaan', 'abc1234', '--', '*.vue']);
    });

    it('reports a friendly message when there are no matches', async () => {
        vi.mocked(run).mockResolvedValue({ stdout: '', stderr: '', status: 1 } as never);
        expect(await grepCodebase('/repo', { pattern: 'nope', commit: 'abc1234' })).toBe('No matches for "nope" at abc1234.');
    });

    it('truncates to 50 lines and notes the total', async () => {
        const lines = Array.from({ length: 60 }, (_, i) => `abc1234:src/File.ts:${i + 1}:match`);
        vi.mocked(run).mockResolvedValue({ stdout: lines.join('\n'), stderr: '', status: 0 } as never);

        const output = await grepCodebase('/repo', { pattern: 'match', commit: 'abc1234' });
        const outputLines = output.split('\n');
        expect(outputLines).toHaveLength(51); // 50 matches + the truncation note
        expect(output).toContain('showing the first 50 of 60 matching lines');
    });
});

describe('loadTranslationPrompt', () => {
    it('falls back to the built-in prompt when the file is missing', async () => {
        const prompt = await loadTranslationPrompt('/repo', '/does/not/exist.md');
        expect(prompt).toContain('Dutch');
    });
});

describe('buildTranslationUserMessage', () => {
    it('includes the release tag, date and the English markdown', () => {
        const message = buildTranslationUserMessage(notes, '### Bug fixes\n- Fixed it (abc123)');
        expect(message).toContain('Release: v2.124.0 (2026-06-26)');
        expect(message).toContain('### Bug fixes');
        expect(message).toContain('get_commit_diff');
    });
});

describe('translateReleaseNotes', () => {
    it('passes the prompt and English notes to the model and trims the result', async () => {
        let received: TranslationRequest | undefined;
        const model = fakeModel('  ## Wat is er veranderd?\n- Iets  ', (req) => {
            received = req;
        });

        const result = await translateReleaseNotes('/repo', notes, '### Bug fixes\n- Fixed it (abc123)', model);

        expect(result).toBe('## Wat is er veranderd?\n- Iets');
        expect(received?.systemPrompt).toContain('Dutch');
        expect(received?.userContent).toContain('### Bug fixes');
    });

    it('forwards the onToolCall hook and resolves diffs through the git repo', async () => {
        vi.mocked(run).mockResolvedValue({ stdout: 'the diff', stderr: '', status: 0 } as never);
        const calls: { name: string; input: Record<string, unknown> }[] = [];
        const model: TranslationModel = {
            name: 'fake:diff',
            translate: async (request) => {
                request.onToolCall?.({ name: 'get_commit_diff', input: { hash: 'abc123' } });
                const diff = await request.fetchCommitDiff('abc123');
                return `diff was: ${diff}`;
            },
        };

        const result = await translateReleaseNotes('/repo', notes, 'notes', model, {
            onToolCall: call => calls.push(call),
        });

        expect(result).toBe('diff was: the diff');
        expect(calls).toEqual([{ name: 'get_commit_diff', input: { hash: 'abc123' } }]);
    });
});

describe('composeReleaseNotesBody', () => {
    it('returns English only when translation is skipped', async () => {
        const body = await composeReleaseNotesBody('/repo', notes, 'ENGLISH', { skipTranslation: true });
        expect(body).toBe('ENGLISH');
    });

    it('warns and returns English only when the provider is unavailable', async () => {
        vi.mocked(resolveTranslationModel).mockResolvedValue({ unavailable: 'ANTHROPIC_API_KEY is not set' });
        const warnings: string[] = [];
        const body = await composeReleaseNotesBody('/repo', notes, 'ENGLISH', {
            provider: 'claude',
            onWarn: msg => warnings.push(msg),
        });
        expect(body).toBe('ENGLISH');
        expect(warnings[0]).toContain('ANTHROPIC_API_KEY is not set');
    });

    it('logs progress, including each commit the model inspects', async () => {
        vi.mocked(run).mockResolvedValue({ stdout: 'the diff', stderr: '', status: 0 } as never);

        // A model that inspects one commit before producing the translation.
        const model: TranslationModel = {
            name: 'fake:logging',
            translate: async (request) => {
                request.onToolCall?.({ name: 'get_commit_diff', input: { hash: 'abc1234' } });
                await request.fetchCommitDiff('abc1234');
                return '## Wat is er veranderd?';
            },
        };
        vi.mocked(resolveTranslationModel).mockResolvedValue({ model });

        const infos: string[] = [];
        const body = await composeReleaseNotesBody('/repo', notes, 'ENGLISH', {
            onInfo: msg => infos.push(msg),
        });

        expect(body).toContain('## Wat is er veranderd?');
        expect(infos.some(line => line.includes('Translating release notes to Dutch with fake:logging'))).toBe(true);
        expect(infos.some(line => line.includes('Inspecting commit abc1234'))).toBe(true);
        expect(infos.some(line => line.includes('inspected 1 commit diff'))).toBe(true);
    });
});
