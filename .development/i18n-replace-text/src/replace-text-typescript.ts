import fs from "fs";
import { getFilesToSearch } from "./get-files-to-search";
import { getWhiteSpaceBeforeAndAfter } from "./regex-helper";
import { wrapWithTranslationFunction } from "./translation-helper";

const quoteRegex = /"([^"]*?)"|'([^']*?)'/ig;

export function replaceTextInTypescriptString(value: string): string {
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

export function replaceTextInTypescript() {
    const files = getFilesToSearch(['vue']);

    for (const filePath of files) {
        const fileContent = fs.readFileSync(filePath, "utf8");
        const newContent = replaceTextInTypescriptFileContent(fileContent);

        if(fileContent !== newContent) {
            fs.writeFileSync(filePath, newContent);
            console.log('Replaced vue template text in:');
            console.log('- '+filePath);
        }
    }
}

export function replaceTextInTypescriptFileContent(content: string) {
    let newContent = content;

    let matches: RegExpExecArray | null;

    while ((matches = quoteRegex.exec(content)) !== null) {
        const match = matches[0];
        if(!match) {
            continue;
        }

        const trimmedMatch = match.trim();
            
        if(trimmedMatch.length === 0) {
            continue;
        }

        const transformed = replaceTextInTypescriptString(match);

        if(match !== transformed) {
            newContent = newContent.replace(`"${match}"`, `"${transformed}"`);
        }
    }

    return newContent;
}
