import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from './command-runner.js';
import type { ReleaseNotes } from './release-notes.js';
import { resolveTranslationModel } from './translation/create-translation-model.js';
import type { CodebaseGrepper, CommitDiffFetcher, TranslationModel } from './translation/translation-model.js';

/** Editable prompt, relative to the repo root. Edit this file to tune the translation. */
export const TRANSLATION_PROMPT_RELATIVE_PATH = '.development/release-notes-prompt.md';

/** Fallback prompt used when the editable file is missing (e.g. running from a published package). */
const BUILT_IN_PROMPT = `You translate Stamhoofd's English developer release notes into a Dutch (nl-BE) changelog for end users.
- Write in Dutch, concise and friendly, using "je"/"jullie". Describe the changes, don't include text why something is added or why it is convenient.
- Keep the section structure with translated, emoji-prefixed headings; rewrite user-facing items from the user's perspective and drop technical jargon, file names and hashes.
- Keep the developer and dependency sections to a single short line each.
- Call the get_commit_diff tool for each change with its commit hash before describing it.
- Output only the Dutch markdown.
- Translate some words this way: 'organizations' -> 'verenigingen'`;

/** Largest diff (in characters) we feed back to the model, to bound token cost. */
const MAX_DIFF_LENGTH = 16000;

/** Largest translations block (in characters) appended to a diff, to bound token cost. */
const MAX_TRANSLATIONS_LENGTH = 8000;

/** Most matching lines returned from a single grep, to bound token cost. */
const MAX_GREP_LINES = 50;

/** nl.json source strings, relative to the repo root. */
const LOCALE_RELATIVE_PATH = 'shared/locales/src/nl.json';

/** Matches translation key references in source: $t('%AbC'), $t("%AbC") or $t(`%AbC`). */
const TRANSLATION_KEY_PATTERN = /\$t\(\s*['"`](%[0-9A-Za-z]+)['"`]/g;

/** Loads the translation system prompt: the editable repo file, or the built-in fallback. */
export async function loadTranslationPrompt(cwd: string, promptFile?: string): Promise<string> {
    const candidate = promptFile ?? join(cwd, TRANSLATION_PROMPT_RELATIVE_PATH);
    try {
        const contents = (await readFile(candidate, 'utf8')).trim();
        return contents.length > 0 ? contents : BUILT_IN_PROMPT;
    } catch {
        return BUILT_IN_PROMPT;
    }
}

/** Reads a single commit's diff for the model's get_commit_diff tool. Validates the hash first. */
export async function getCommitDiff(cwd: string, hash: string): Promise<string> {
    if (!/^[0-9a-f]{4,40}$/i.test(hash)) {
        return `Invalid commit hash: ${hash}`;
    }
    const result = await run('git', ['show', '--no-color', '--stat', '--patch', hash], { cwd, capture: true, allowFailure: true });
    if (result.status !== 0) {
        return `Could not load the diff for ${hash}: ${result.stderr.trim()}`;
    }

    // Resolve translation keys from the full diff first, so we still surface them when the diff is truncated.
    const translations = await collectTranslationsForDiff(cwd, result.stdout);
    const diff = result.stdout.length > MAX_DIFF_LENGTH
        ? `${result.stdout.slice(0, MAX_DIFF_LENGTH)}\n…(diff truncated)…`
        : result.stdout;

    return translations ? `${diff}\n\n${translations}` : diff;
}

/**
 * Searches the committed files at a commit for the model's grep_codebase tool, like `git grep`.
 * Validates the commit hash and feeds the pattern via `-e` so it can never be read as an option;
 * `run` invokes git without a shell, so the pattern and pathspec are safe positional arguments.
 */
export async function grepCodebase(cwd: string, input: Record<string, unknown>): Promise<string> {
    const pattern = typeof input.pattern === 'string' ? input.pattern : '';
    const commit = typeof input.commit === 'string' ? input.commit : '';

    if (pattern.length === 0) {
        return 'Invalid grep: a non-empty "pattern" is required.';
    }
    if (!/^[0-9a-f]{4,40}$/i.test(commit)) {
        return `Invalid commit hash: ${commit}`;
    }

    // -n line numbers, -I skip binary files. The commit is a tree-ish, so git searches that revision.
    const args = ['grep', '--no-color', '-n', '-I'];
    if (input.ignoreCase === true) {
        args.push('-i');
    }
    if (input.fixedString === true) {
        args.push('-F');
    }
    if (input.wordMatch === true) {
        args.push('-w');
    }
    args.push('-e', pattern, commit);
    if (typeof input.pathspec === 'string' && input.pathspec.trim().length > 0) {
        args.push('--', input.pathspec.trim());
    }

    const result = await run('git', args, { cwd, capture: true, allowFailure: true });

    // git grep exits 1 (no error output) when there are simply no matches.
    if (result.status === 1 && result.stderr.trim().length === 0) {
        return `No matches for ${JSON.stringify(pattern)} at ${commit}.`;
    }
    if (result.status !== 0) {
        return `Could not search ${commit}: ${result.stderr.trim()}`;
    }

    // git prefixes every line with "<commit>:" for a tree-ish search; strip it for cleaner output.
    const prefix = `${commit}:`;
    const lines = result.stdout
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => line.startsWith(prefix) ? line.slice(prefix.length) : line);

    if (lines.length <= MAX_GREP_LINES) {
        return lines.join('\n');
    }
    return `${lines.slice(0, MAX_GREP_LINES).join('\n')}\n…(truncated: showing the first ${MAX_GREP_LINES} of ${lines.length} matching lines)…`;
}

/**
 * Finds every `$t` reference in a diff and resolves it against nl.json, so the model
 * translates from the actual Dutch source string instead of the opaque key.
 */
async function collectTranslationsForDiff(cwd: string, diff: string): Promise<string> {
    const keys = new Set<string>();
    for (const match of diff.matchAll(TRANSLATION_KEY_PATTERN)) {
        keys.add(match[1]);
    }
    if (keys.size === 0) {
        return '';
    }

    const strings = await loadLocaleStrings(cwd);
    const lines: string[] = [];
    for (const key of keys) {
        const value = strings[key];
        if (typeof value === 'string') {
            lines.push(`${key}: ${JSON.stringify(value)}`);
        }
    }
    if (lines.length === 0) {
        return '';
    }

    let block = `Dutch source strings (nl.json) for the $t() keys referenced in this commit:\n${lines.join('\n')}`;
    if (block.length > MAX_TRANSLATIONS_LENGTH) {
        block = `${block.slice(0, MAX_TRANSLATIONS_LENGTH)}\n…(translations truncated)…`;
    }
    return block;
}

/** Cached nl.json contents, keyed by absolute path so repeated tool calls don't re-read the file. */
let localeCache: { path: string; strings: Record<string, unknown> } | undefined;

/** Loads and parses nl.json from the repo, returning an empty map if it cannot be read. */
async function loadLocaleStrings(cwd: string): Promise<Record<string, unknown>> {
    const path = join(cwd, LOCALE_RELATIVE_PATH);
    if (localeCache?.path === path) {
        return localeCache.strings;
    }
    try {
        const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
        const strings = typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
        localeCache = { path, strings };
        return strings;
    } catch {
        return {};
    }
}

/** Builds the user message: the English notes plus the context the model needs. */
export function buildTranslationUserMessage(notes: ReleaseNotes, englishMarkdown: string): string {
    const lines = [
        `Release: ${notes.to}${notes.date ? ` (${notes.date})` : ''}`,
        '',
        'Below are the generated English release notes. Translate them into Dutch for end users following the system instructions.',
        'The commit hash in parentheses after each item can be passed to the get_commit_diff tool when an item is unclear.',
        '',
        englishMarkdown.trim(),
    ];
    return lines.join('\n');
}

/**
 * Produces the Dutch end-user translation of the release notes using the given model.
 * The model may call get_commit_diff (resolved against the local git repo) for unclear commits.
 */
export async function translateReleaseNotes(
    cwd: string,
    notes: ReleaseNotes,
    englishMarkdown: string,
    model: TranslationModel,
    options: { promptFile?: string; onToolCall?: (call: { name: string; input: Record<string, unknown> }) => void } = {},
): Promise<string> {
    const systemPrompt = await loadTranslationPrompt(cwd, options.promptFile);
    const userContent = buildTranslationUserMessage(notes, englishMarkdown);

    const fetchCommitDiff: CommitDiffFetcher = hash => getCommitDiff(cwd, hash);
    const grepCodebaseTool: CodebaseGrepper = input => grepCodebase(cwd, input);

    const result = await model.translate({ systemPrompt, userContent, fetchCommitDiff, grepCodebase: grepCodebaseTool, onToolCall: options.onToolCall });

    return result.trim();
}

export type ComposeReleaseNotesOptions = {
    /** Skip translation entirely and return only the English notes. */
    skipTranslation?: boolean;
    provider?: string;
    model?: string;
    promptFile?: string;
    onInfo?: (message: string) => void;
    onWarn?: (message: string) => void;
};

/**
 * Returns the English release notes with the Dutch end-user translation appended. Falls back to
 * the English-only notes when translation is skipped, the API key is missing, or the model errors.
 */
export async function composeReleaseNotesBody(
    cwd: string,
    notes: ReleaseNotes,
    englishMarkdown: string,
    options: ComposeReleaseNotesOptions = {},
): Promise<string> {
    if (options.skipTranslation) {
        return englishMarkdown;
    }

    const resolution = await resolveTranslationModel({ provider: options.provider, model: options.model });
    if ('unavailable' in resolution) {
        options.onWarn?.(`Skipping Dutch translation: ${resolution.unavailable}`);
        return englishMarkdown;
    }

    try {
        options.onInfo?.(`Translating release notes to Dutch with ${resolution.model.name}…`);

        let diffRequests = 0;
        const dutch = await translateReleaseNotes(cwd, notes, englishMarkdown, resolution.model, {
            promptFile: options.promptFile,
            onToolCall: ({ name, input }) => {
                if (name === 'get_commit_diff') {
                    diffRequests++;
                    options.onInfo?.(`  ↳ Inspecting commit ${typeof input.hash === 'string' ? input.hash : '?'} for a clearer translation…`);
                } else if (name === 'grep_codebase') {
                    options.onInfo?.(`  ↳ Searching the codebase for ${typeof input.pattern === 'string' ? JSON.stringify(input.pattern) : '?'}…`);
                } else {
                    options.onInfo?.(`  ↳ Model called tool ${name}(${JSON.stringify(input)})`);
                }
            },
        });

        options.onInfo?.(diffRequests > 0
            ? `Dutch translation ready (inspected ${diffRequests} commit diff${diffRequests === 1 ? '' : 's'}).`
            : 'Dutch translation ready (the model did not need to inspect any commit diffs).');
        return `${englishMarkdown.trimEnd()}\n\n---\n\n${dutch}\n`;
    } catch (error) {
        options.onWarn?.(`Could not translate release notes: ${error instanceof Error ? error.message : String(error)}`);
        return englishMarkdown;
    }
}
