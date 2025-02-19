import { getWhiteSpaceBeforeAndAfter } from "./regex-helper";
import { wrapWithTranslationFunction } from "./translation-helper";

const quoteRegex = /"([^"]*?)"|'([^']*?)'/ig;

export function replaceTextInTypescript(value: string): string {
    let matches: RegExpExecArray | null;
    let result = value;

    while((matches = quoteRegex.exec(value)) !== null) {
        const match = matches[0];

        if(!match) {
            continue;
        }

        const unquotedMatch = match.slice(1, match.length - 1);
        const trimmedMatch = unquotedMatch.trim();
        
        if(trimmedMatch.length === 0) {
            continue;
        }

        const before = value.slice(0, matches.index);

        // not possible to know if should be translated
        const isArgument = before.endsWith('(');

        if(isArgument) {
            continue;
        }

        const isTranslated = before.endsWith('$t(') || before.startsWith('$t(');

        if(isTranslated) {
            continue;
        }

        const isEquality = ['==', '!=', '>=', '<='].some(item => before.endsWith(item + ' ') || before.endsWith(item));

        if(isEquality) {
            continue;
        }

        const {whiteSpaceBefore, whiteSpaceAfter} = getWhiteSpaceBeforeAndAfter(unquotedMatch);
        const quotedWhiteSpaceBefore = whiteSpaceBefore.length ? `"${whiteSpaceBefore}" + ` : '';
        const quotedWhiteSpaceAfter = whiteSpaceAfter.length ? ` + "${whiteSpaceAfter}"` : '';

        result = result.replace(match, quotedWhiteSpaceBefore + wrapWithTranslationFunction(trimmedMatch) + quotedWhiteSpaceAfter);
    }

    return result;
}
