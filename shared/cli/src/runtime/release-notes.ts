import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from './command-runner.js';

export type Commit = {
    hash: string;
    emoji: string;
    description: string;
    /** The commit author name (who wrote the change), not the committer who merged it. */
    author: string;
    /** The author's GitHub login, when it could be resolved. Rendered as a clickable @mention. */
    login?: string;
};

export type ReleaseNotesSection = {
    title: string;
    commits: Commit[];
};

export type ReleaseNotes = {
    /** The tag (or ref) the notes start after, exclusive. Undefined when there is no previous tag. */
    from?: string;
    /** The tag (or ref) the notes go up to, inclusive. */
    to: string;
    /** Creation date of the `to` tag (YYYY-MM-DD), or undefined when it cannot be resolved. */
    date?: string;
    sections: ReleaseNotesSection[];
    /** All notable commits (emoji-prefixed or dependency updates), newest first. */
    commits: Commit[];
};

/**
 * Maps gitmoji-style commit prefixes to a human readable release-notes section.
 * The first matching section wins, and sections are rendered in this order.
 * Any emoji commit that does not match a section ends up in "Other changes".
 */
const SECTIONS: { title: string; emojis: string[] }[] = [
    { title: '✨ New', emojis: ['✨', '🎉', '🚀', '💫'] },
    { title: '🐛 Bug fixes', emojis: ['🐛', '🚑', '🩹'] },
    { title: '🎨 Improvements', emojis: ['💄', '🎨', '📱'] },
    { title: '⚡️ Performance', emojis: ['⚡'] },
    { title: '🔒️ Security & privacy', emojis: ['🔒', '🛡', '🔐', '🔑'] },
    { title: '🌐 Translations', emojis: ['🌐', '💬'] },
    { title: '📝 Documentation', emojis: ['📝', '📚', '💡'] },
    { title: '🧰 Developers', emojis: ['🧑‍💻', '🔧', '🔨', '👷', '💚', '✅', '🧪', '🚨', '🩺', '🧰'] },
    { title: '♻️ Refactoring', emojis: ['♻', '🏗', '🔀', '🔥'] },
    { title: '⬆️ Dependencies', emojis: ['⬆', '⬇', '📌', '➕', '➖', '📦'] },
];

const OTHER_SECTION_TITLE = '🔖 Other changes';

const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

/** Field separator used in the git log output (ASCII unit separator). */
const FIELD_SEPARATOR = '';

/** Removes emoji variation selectors (U+FE0E/U+FE0F) so "♻️" and "♻" compare equal. */
function normalizeEmoji(emoji: string): string {
    return emoji.replace(/\uFE0E|\uFE0F/gu, '');
}

/**
 * Returns the leading emoji of a commit subject together with the remaining text,
 * or null when the subject does not start with an emoji.
 */
export function parseEmojiCommit(subject: string): { emoji: string; description: string } | null {
    const trimmed = subject.trimStart();
    const first = graphemeSegmenter.segment(trimmed)[Symbol.iterator]().next();
    if (first.done) {
        return null;
    }

    const grapheme = first.value.segment;
    if (!/\p{Extended_Pictographic}/u.test(grapheme)) {
        return null;
    }

    return {
        emoji: grapheme,
        description: trimmed.slice(grapheme.length).trim(),
    };
}

/** The emoji used to group dependency-bot commits, so they land in the Dependencies section. */
const DEPENDENCY_EMOJI = '⬆';

/** Matches the GitHub usernames/emails used by Renovate and Dependabot. */
const DEPENDENCY_BOT_PATTERN = /\b(?:renovate|dependabot)\b/i;

/** Matches the conventional commit subjects those bots use when no emoji is present. */
const DEPENDENCY_SUBJECT_PATTERNS = [
    /^(?:chore|build|fix|ci)\(deps(?:-dev)?\)!?:/i, // chore(deps): / build(deps-dev): ...
    /^update (?:dependency |.+ (?:to|from) )/i, // Renovate: "Update dependency x to v1"
    /^bump \S+ from \S+ to \S+/i, // Dependabot: "Bump x from 1 to 2"
    /^(?:roll up|update) \S+ (?:dependencies|monorepo)/i, // Renovate grouped updates
];

/** Whether a non-emoji commit is clearly an automated dependency update. */
export function isDependencyCommit(options: { author?: string; email?: string; subject: string }): boolean {
    if ((options.author && DEPENDENCY_BOT_PATTERN.test(options.author)) || (options.email && DEPENDENCY_BOT_PATTERN.test(options.email))) {
        return true;
    }
    const subject = options.subject.trimStart();
    return DEPENDENCY_SUBJECT_PATTERNS.some(pattern => pattern.test(subject));
}

function sectionTitleFor(emoji: string): string {
    const normalized = normalizeEmoji(emoji);
    for (const section of SECTIONS) {
        if (section.emojis.some(candidate => normalizeEmoji(candidate) === normalized)) {
            return section.title;
        }
    }
    return OTHER_SECTION_TITLE;
}

/** Groups commits into sections, preserving the order defined in SECTIONS. */
export function groupCommits(commits: Commit[]): ReleaseNotesSection[] {
    const byTitle = new Map<string, Commit[]>();
    for (const commit of commits) {
        const title = sectionTitleFor(commit.emoji);
        const list = byTitle.get(title) ?? [];
        list.push(commit);
        byTitle.set(title, list);
    }

    const orderedTitles = [...SECTIONS.map(section => section.title), OTHER_SECTION_TITLE];
    const sections: ReleaseNotesSection[] = [];
    for (const title of orderedTitles) {
        const list = byTitle.get(title);
        if (list && list.length > 0) {
            sections.push({ title, commits: list });
        }
    }
    return sections;
}

/** Reads the list of version tags, sorted from newest to oldest. */
export async function getVersionTags(cwd: string): Promise<string[]> {
    const result = await run('git', ['tag', '--list', 'v*', '--sort=-v:refname'], { cwd, capture: true });
    return result.stdout.split('\n').map(line => line.trim()).filter(line => line.length > 0);
}

/** The tag of the most recent release, or undefined when no version tags exist yet. */
export async function getLatestVersionTag(cwd: string): Promise<string | undefined> {
    return (await getVersionTags(cwd))[0];
}

/** The version tag released right before the given tag, based on semver ordering. */
export async function getPreviousVersionTag(cwd: string, tag: string): Promise<string | undefined> {
    const tags = await getVersionTags(cwd);
    const index = tags.indexOf(tag);
    if (index === -1) {
        // The tag is not in the list (e.g. not created yet): treat the newest existing tag as previous.
        return tags[0];
    }
    return tags[index + 1];
}

/**
 * Collects the notable commits in `from..to` (or up to `to` when `from` is omitted).
 * A commit is notable when it starts with an emoji, or when it is an automated dependency
 * update from Renovate/Dependabot (which then gets grouped under Dependencies).
 */
export async function collectReleaseCommits(cwd: string, options: { from?: string; to: string }): Promise<Commit[]> {
    const range = options.from ? `${options.from}..${options.to}` : options.to;
    const format = `--pretty=format:%h${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%ae${FIELD_SEPARATOR}%s`;
    const result = await run('git', ['log', '--no-merges', format, range], { cwd, capture: true });

    const commits: Commit[] = [];
    for (const line of result.stdout.split('\n')) {
        if (line.length === 0) {
            continue;
        }
        const [hash, author, email, ...subjectParts] = line.split(FIELD_SEPARATOR);
        if (hash === undefined || subjectParts.length === 0) {
            continue;
        }
        const subject = subjectParts.join(FIELD_SEPARATOR);

        const parsed = parseEmojiCommit(subject);
        if (parsed) {
            commits.push({ hash, emoji: parsed.emoji, description: parsed.description, author: author ?? '' });
            continue;
        }

        if (isDependencyCommit({ author, email, subject })) {
            commits.push({ hash, emoji: DEPENDENCY_EMOJI, description: subject.trim(), author: author ?? '' });
        }
    }
    return commits;
}

/**
 * Resolves the date (YYYY-MM-DD) of a ref. For a tag this is its creation date
 * (the tagger date for annotated tags, the commit date for lightweight tags);
 * for any other ref (e.g. HEAD) it falls back to the commit date.
 */
export async function getRefDate(cwd: string, ref: string): Promise<string | undefined> {
    const tagResult = await run('git', ['for-each-ref', '--format=%(creatordate:short)', `refs/tags/${ref}`], { cwd, capture: true, allowFailure: true });
    const tagDate = tagResult.stdout.trim();
    if (tagDate.length > 0) {
        return tagDate;
    }

    const commitResult = await run('git', ['log', '-1', '--format=%cs', ref], { cwd, capture: true, allowFailure: true });
    const commitDate = commitResult.stdout.trim();
    return commitDate.length > 0 ? commitDate : undefined;
}

/** Resolves a ref to its full commit sha, or undefined when it cannot be resolved. */
async function revParse(cwd: string, ref: string): Promise<string | undefined> {
    const result = await run('git', ['rev-parse', ref], { cwd, capture: true, allowFailure: true });
    const sha = result.stdout.trim();
    return sha.length > 0 ? sha : undefined;
}

/**
 * Maps the full commit shas in `from..to` to their author's GitHub login using the
 * compare API (which resolves authors GitHub-side, since local commits only carry an
 * email/name). Returns an empty map when the API is unreachable or the commits are not
 * yet pushed, so callers degrade gracefully to plain author names.
 */
export async function resolveAuthorLogins(cwd: string, repositorySlug: string, from: string, to: string): Promise<Map<string, string>> {
    const logins = new Map<string, string>();

    // The compare API needs a pushed ref/sha on both ends; resolve HEAD to a sha first.
    const head = to === 'HEAD' ? await revParse(cwd, 'HEAD') ?? to : to;
    const result = await run('gh', ['api', `repos/${repositorySlug}/compare/${from}...${head}`, '--jq', '.commits[] | [.sha, (.author.login // "")] | @tsv'], { cwd, capture: true, allowFailure: true });
    if (result.status !== 0) {
        return logins;
    }

    for (const line of result.stdout.split('\n')) {
        const [sha, login] = line.split('\t');
        if (sha && login) {
            logins.set(sha, login);
        }
    }
    return logins;
}

/** Looks up a login for a (possibly abbreviated) commit hash. */
function loginForHash(logins: Map<string, string>, hash: string): string | undefined {
    for (const [sha, login] of logins) {
        if (sha.startsWith(hash)) {
            return login;
        }
    }
    return undefined;
}

/** Builds release notes for the commits between two refs. */
export async function buildReleaseNotes(cwd: string, options: { from?: string; to: string; repositorySlug?: string }): Promise<ReleaseNotes> {
    const commits = await collectReleaseCommits(cwd, options);
    const date = await getRefDate(cwd, options.to);

    if (options.repositorySlug && options.from) {
        const logins = await resolveAuthorLogins(cwd, options.repositorySlug, options.from, options.to);
        for (const commit of commits) {
            commit.login = loginForHash(logins, commit.hash);
        }
    }

    return {
        from: options.from,
        to: options.to,
        date,
        commits,
        sections: groupCommits(commits),
    };
}

/** Reads the version that is being released. Lerna keeps this in lerna.json (fixed mode). */
export async function getReleaseVersion(cwd: string): Promise<string> {
    const raw = await readFile(join(cwd, 'lerna.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    if (!parsed.version || parsed.version === 'independent') {
        throw new Error('No fixed version found in lerna.json');
    }
    return parsed.version;
}

/** Parses "owner/repo" out of the origin remote URL (https or ssh form). */
export async function getRepositorySlug(cwd: string): Promise<string | undefined> {
    const result = await run('git', ['remote', 'get-url', 'origin'], { cwd, capture: true, allowFailure: true });
    if (result.status !== 0) {
        return undefined;
    }
    const url = result.stdout.trim();
    const match = url.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
    return match ? match[1] : undefined;
}

/** Formats a YYYY-MM-DD date as a human readable string, falling back to the raw value. */
function formatReleaseDate(isoDate: string): string {
    const parsed = new Date(`${isoDate}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
        return isoDate;
    }
    return new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(parsed);
}

/** Renders release notes as GitHub-flavoured markdown. Returns a friendly placeholder when empty. */
export function renderReleaseNotes(notes: ReleaseNotes, options: { repositorySlug?: string } = {}): string {
    const lines: string[] = [];

    if (notes.date) {
        lines.push(`_Released on ${formatReleaseDate(notes.date)}_`);
        lines.push('');
    }

    if (notes.sections.length === 0) {
        lines.push('_No notable changes._');
    } else {
        for (const section of notes.sections) {
            lines.push(`### ${section.title}`);
            for (const commit of section.commits) {
                // Keep the emoji in "Other changes" so the grouping stays meaningful.
                const prefix = section.title === OTHER_SECTION_TITLE ? `${commit.emoji} ` : '';
                // Prefer the GitHub @login (clickable mention); fall back to the plain author name.
                const authorLabel = commit.login ? `@${commit.login}` : commit.author;
                const author = authorLabel ? ` — ${authorLabel}` : '';
                lines.push(`- ${prefix}${commit.description} (${commit.hash})${author}`);
            }
            lines.push('');
        }
    }

    if (options.repositorySlug && notes.from) {
        lines.push(`**Full changelog**: https://github.com/${options.repositorySlug}/compare/${notes.from}...${notes.to}`);
    }

    return lines.join('\n').trim() + '\n';
}
