/** Fetches the full diff (patch) of a commit by hash, so a model can inspect an unclear change. */
export type CommitDiffFetcher = (hash: string) => Promise<string>;

/** Greps the committed files at a specific commit. Receives the raw tool input and validates it. */
export type CodebaseGrepper = (input: Record<string, unknown>) => Promise<string>;

export type TranslationRequest = {
    /** Provider-agnostic system prompt describing how to translate. */
    systemPrompt: string;
    /** The English release notes (plus context) to translate. */
    userContent: string;
    /** Tool the model may call to read a commit's diff when a description is unclear. */
    fetchCommitDiff: CommitDiffFetcher;
    /** Tool the model may call to search the committed code at a commit for more context. */
    grepCodebase: CodebaseGrepper;
    /** Called for every tool the model invokes, before it runs — used for progress logging. */
    onToolCall?: (call: { name: string; input: Record<string, unknown> }) => void;
};

/**
 * A translation backend (OpenAI, Claude, ...). Implementations own the provider-specific
 * request/tool-call loop and expose the same surface so the provider can be swapped via config.
 */
export interface TranslationModel {
    /** Human-readable identifier, e.g. "openai:gpt-5.5". Used in logs. */
    readonly name: string;
    /** Runs the translation, resolving `get_commit_diff` / `grep_codebase` tool calls against the request. */
    translate(request: TranslationRequest): Promise<string>;
}

/** The tool the model can call to inspect a commit. Shared shape, translated per provider. */
export const COMMIT_DIFF_TOOL = {
    name: 'get_commit_diff',
    description: 'Fetch the full diff (patch) of a specific commit by its short or full hash. Use this when a commit message is unclear and you need to see the actual code change to write an accurate, end-user-friendly Dutch description.',
    parameters: {
        type: 'object' as const,
        properties: {
            hash: { type: 'string', description: 'The commit hash (short or full) to inspect, as shown in parentheses in the release notes.' },
        },
        required: ['hash'],
        additionalProperties: false,
    },
};

/** The tool the model can call to search committed source files at a specific commit. */
export const GREP_TOOL = {
    name: 'grep_codebase',
    description: 'Search the committed source files at a specific commit for a pattern (like `git grep`). Returns matching lines as `<file>:<line>:<text>`. Use it to see how a change is used elsewhere, or what a translation key / symbol means, when the diff alone is not enough. At most 50 matching lines are returned; the result says so when it is truncated.',
    parameters: {
        type: 'object' as const,
        properties: {
            pattern: { type: 'string', description: 'The text or regular expression to search for. Treated as a regex unless fixedString is true.' },
            commit: { type: 'string', description: 'The commit hash (short or full) whose committed files should be searched.' },
            ignoreCase: { type: 'boolean', description: 'Case-insensitive search (git grep -i). Optional, defaults to false.' },
            fixedString: { type: 'boolean', description: 'Match the pattern literally instead of as a regular expression (git grep -F). Optional, defaults to false.' },
            wordMatch: { type: 'boolean', description: 'Only match whole words (git grep -w). Optional, defaults to false.' },
            pathspec: { type: 'string', description: 'Optional git pathspec to limit the search, e.g. "*.vue" or "frontend/". Omit to search every file.' },
        },
        required: ['pattern', 'commit'],
        additionalProperties: false,
    },
};

/** Maximum number of tool-call round trips before we give up, to bound cost and avoid loops. */
export const MAX_TOOL_ITERATIONS = 12;
