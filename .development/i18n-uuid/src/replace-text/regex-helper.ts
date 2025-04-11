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

export function getIndexOfLastNewLine(value: string): number {
   return value.search(/(\r|\n)(?=.*$)/);
}

export function getIndexOfFirstNewLine(value: string): number {
    return value.search(/(\r|\n)/);
 }
 
export function splitInParts(text: string, regex: RegExp): {isMatch: boolean, value: string}[] {
    const matches = [...text.matchAll(regex)];
    const startsWithMatch = matches[0]?.index === 0;
    const matchedText = matches.map(match => match[0]);
    const otherText = text.split(regex);

    if(startsWithMatch) {
        const removed = otherText.shift();
        if(removed !== '') {
            throw new Error('Removed part is not empty')
        }
    }

    const results: {isMatch: boolean, value: string}[] = [];

    for(let i = 0; i < otherText.length; i++) {
        const part = otherText[i];

        const matchedPart = matchedText[i];
        if(startsWithMatch && matchedPart !== undefined) {
            results.push({value: matchedPart, isMatch: true});
        }

        if(part !== undefined && part !== null && part.length > 0) {
            results.push({value: part, isMatch: false});
        }

        if(!startsWithMatch && matchedPart !== undefined) {
            results.push({value: matchedPart, isMatch: true});
        }
    }

    return results;
}
