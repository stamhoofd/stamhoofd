export function escapeRegExp(stringToGoIntoTheRegex: string): string {
    return stringToGoIntoTheRegex.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function createRegexPattern(stringToGoIntoTheRegex: string): RegExp {
    return new RegExp(escapeRegExp(stringToGoIntoTheRegex), 'g');
}

export function getWhiteSpaceBeforeAndAfter(value: string) {
    return {
        whiteSpaceBefore: /(^\s+)/.exec(value)?.[0] ?? '',
        whiteSpaceAfter: /(\s+$)/.exec(value)?.[0] ?? ''
    }
}

export function isNumberOrSpecialCharacter(value: string) {
    return /(^-?\d+$)|(^-?[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~]+$)/.test(value);
}
