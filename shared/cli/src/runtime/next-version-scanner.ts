/**
 * Finds every `...NextVersion` inside a field decorator and replaces it by an explicit version.
 *
 * Any object literal inside the decorator counts, no matter how deeply it is nested in calls: both spreading
 * NextVersion directly into the decorator's options object and spreading it into the options object of a
 * helper call (such as `TranslatedString.field`) are rewritten. Line and block comments are ignored, and so are
 * string literals (single quoted, double quoted and template literals), so a `//` or `/*` inside a string does not
 * start a comment.
 */
export const needle = '...NextVersion';

export type ReplaceResult = { content: string; replaced: number };

export function replaceNextVersion(content: string, replaceBy: string): ReplaceResult {
    const state = {
        atStack: '', // contains @, @f, @fi, @fie, @field
        parenthesisDepth: 0, // 0 when atStack is not @field, then 1 once first ( is found, 2 if second ( is found, etc.
        curlyBracketsDepth: 0, // 0 when atStack is not @field, then 1 once first { is found, 2 if second { is found, etc.
        contentStack: '', // contents inside an object literal of @field( (so atStack is @field, parenthesisDepth >= 1 and curlyBracketsDepth >= 1)
        commentLineStack: '',
        blockCommentStart: -1, // index of the opening /* while inside a block comment, -1 otherwise
        stringQuote: '', // the quote that opened the string literal we are in (', " or `), empty otherwise
    };

    let newContent = content;
    let offset = 0;
    let replaced = 0;

    // Loop all characters in a simple state machine
    for (let i = 0; i < content.length; i++) {
        const char = content[i];

        if (state.blockCommentStart !== -1) {
            // Ignore until the closing */ (which may not overlap the opening /*)
            if (char === '/' && content[i - 1] === '*' && i - 1 > state.blockCommentStart + 1) {
                state.blockCommentStart = -1;
            }
            continue;
        }

        if (state.stringQuote !== '') {
            // Ignore until the closing quote, skipping escaped characters
            if (char === '\\') {
                i++;
            }
            else if (char === state.stringQuote) {
                state.stringQuote = '';
            }
            continue;
        }

        if (state.commentLineStack === '//') {
            // Ignore until next line
            if (char === '\n') {
                state.commentLineStack = '';
            }
            continue;
        }

        if (char === '*' && state.commentLineStack === '/') {
            state.blockCommentStart = i - 1;
            state.commentLineStack = '';
            continue;
        }

        if (char === '/') {
            state.commentLineStack += '/';
        }
        else {
            state.commentLineStack = '';
        }

        if (char === '\'' || char === '"' || char === '`') {
            state.stringQuote = char;
            state.contentStack = '';
            continue;
        }

        if (state.atStack === '@field') {
            switch (char) {
                case '(':
                    state.parenthesisDepth++;
                    state.contentStack = '';
                    break;
                case ')':
                    state.parenthesisDepth--;
                    state.contentStack = '';

                    if (state.parenthesisDepth === 0) {
                        // Reset
                        state.atStack = '';
                        state.curlyBracketsDepth = 0;
                    }
                    break;
                case '{':
                    state.curlyBracketsDepth++;
                    state.contentStack = '';
                    break;
                case '}':
                    state.curlyBracketsDepth--;
                    state.contentStack = '';
                    break;
                default: {
                    if (state.parenthesisDepth >= 1 && state.curlyBracketsDepth >= 1) {
                        state.contentStack += char;

                        if (state.contentStack.endsWith(needle)) {
                            const startIndex = i - needle.length + 1 + offset;
                            const endIndex = i + offset;

                            newContent = newContent.substring(0, startIndex) + replaceBy + newContent.substring(endIndex + 1);
                            offset += replaceBy.length - needle.length;
                            replaced++;

                            state.contentStack = '';
                        }
                    }
                    else {
                        state.contentStack = '';
                    }
                }
            }
        }
        else if (state.atStack === '@fie') {
            if (char === 'l') {
                state.atStack = '@field';
            }
            else {
                state.atStack = '';
                state.contentStack = '';
            }
        }
        else if (state.atStack === '@fi') {
            if (char === 'e') {
                state.atStack = '@fie';
            }
            else {
                state.atStack = '';
                state.contentStack = '';
            }
        }
        else if (state.atStack === '@f') {
            if (char === 'i') {
                state.atStack = '@fi';
            }
            else {
                state.atStack = '';
                state.contentStack = '';
            }
        }
        else if (state.atStack === '@') {
            if (char === 'f') {
                state.atStack = '@f';
            }
            else {
                state.atStack = '';
                state.contentStack = '';
            }
        }
        else if (char === '@') {
            state.atStack = '@';
        }
    }

    return { content: newContent, replaced };
}

/**
 * Reads `ReleasedVersion` from the contents of shared/structures/src/Version.ts
 */
export function readReleasedVersion(content: string): number {
    const match = content.match(/ReleasedVersion = (\d+)/);
    if (!match) {
        throw new Error('Failed to read current version');
    }
    const version = parseInt(match[1]);
    if (version === 0 || isNaN(version)) {
        throw new Error('Failed to read current version');
    }
    return version;
}

/**
 * Writes a new `ReleasedVersion` into the contents of shared/structures/src/Version.ts
 */
export function writeReleasedVersion(content: string, currentVersion: number, nextVersion: number): string {
    const newContent = content.replace('ReleasedVersion = ' + currentVersion, 'ReleasedVersion = ' + nextVersion);
    if (newContent === content) {
        throw new Error('Failed to update version in Version.ts');
    }
    return newContent;
}
