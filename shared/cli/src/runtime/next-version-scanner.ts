/**
 * Finds every `...NextVersion` inside the options object of a `@field(...)` decorator and replaces it by an
 * explicit version. Line comments are ignored.
 */
export const needle = '...NextVersion';

export type ReplaceResult = { content: string; replaced: number };

export function replaceNextVersion(content: string, replaceBy: string): ReplaceResult {
    const state = {
        atStack: '', // contains @, @f, @fi, @fie, @field
        parenthesisDepth: 0, // 0 when atStack is not @field, then 1 once first ( is found, 2 if second ( is found, etc.
        curlyBracketsDepth: 0, // 0 when atStack is not @field, then 1 once first { is found, 2 if second { is found, etc.
        contentStack: '', // contents inside @field({ (so atStack is @field, parenthesisDepth is 1 and curlyBracketsDepth is 1)
        commentLineStack: '',
    };

    let newContent = content;
    let offset = 0;
    let replaced = 0;

    // Loop all characters in a simple state machine
    for (let i = 0; i < content.length; i++) {
        const char = content[i];

        if (state.commentLineStack === '//') {
            // Ignore until next line
            if (char === '\n') {
                state.commentLineStack = '';
            }
            continue;
        }

        if (char === '/') {
            state.commentLineStack += '/';
        }
        else {
            state.commentLineStack = '';
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
                    if (state.parenthesisDepth === 1 && state.curlyBracketsDepth === 1) {
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
 * Reads the structures version from the contents of shared/structures/src/Version.ts
 */
export function readStructuresVersion(content: string): number {
    const match = content.match(/Version = (\d+)/);
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
 * Writes a new structures version into the contents of shared/structures/src/Version.ts
 */
export function writeStructuresVersion(content: string, currentVersion: number, nextVersion: number): string {
    const newContent = content.replace('Version = ' + currentVersion, 'Version = ' + nextVersion);
    if (newContent === content) {
        throw new Error('Failed to update version in Version.ts');
    }
    return newContent;
}
