import fs from "fs";
import { getFilesToSearch } from "./get-files-to-search";
import { escapeRegExp } from "./regex-helper";

const vueTemplateTextRegex = /(?<=<.*(\w|"|')>|}})(?:\w|\d|\n|\s|\\n|[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~])+?(?:\w|\d|\n|\s|\\n|[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~])+?(?=<.*\/.+.?>|{{)/ig;
const attributeRegex = /(?<=(:[^ ().,:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~]+=")).*?(?=")/ig;
const quoteRegex = /"([^"]*?)"|'([^']*?)'/ig;

const templateRegex = /<template>((.|\n)+)<\/template>/;

// todo: handle text arguments -> log only?
// todo: handle attributes

const attributeWhitelist = [
    'placeholder',
    'label',
    'title',
    'text'
];

const convertedWhiteList = attributeWhitelist.map(value => `:${value}=`);

function isAttributeWhitelisted(value: string): boolean {
    for(const item of convertedWhiteList) {
        if(value.startsWith(item)) {
            return true;
        }
    }
    return false;
}

export function replaceVueTemplateText() {
    const files = getFilesToSearch(['vue']);

    for (const filePath of files) {
        const fileContent = fs.readFileSync(filePath, "utf8");
        let newContent = fileContent;

        const templateArray = templateRegex.exec(fileContent);
        if(templateArray === null) {
            continue;
        }
        const template = templateArray[1]
        if(template === null) {
            continue;
        }

        let matches: RegExpExecArray | null;

        //#region replace text
        const doReplaceText = true;

        if(doReplaceText){
            while ((matches = vueTemplateTextRegex.exec(template)) !== null) {
                const match = matches[0];
                if(!match) {
                    continue;
                }
                const trimmedMatch = match.trim();
                
                if(trimmedMatch.length === 0) {
                    continue;
                }

                if(trimmedMatch.startsWith('{{'))
                {
                    continue
                }

                const replaceRegex = new RegExp(`(?<=<.*(\\w|"|')>|}})${escapeRegExp(match)}(?=<.*\/.+.?>|{{)`, 'ig');

                let newLines: string[] = [];

                for(const line of match.split(/\r|\n/)) {
                    const trimmedLine = line.trim();
                
                    if(trimmedLine.length < 2) {
                        continue;
                    }

                    if(isNumberOrSpecialCharacter(trimmedLine)) {
                        continue;
                    }

                    const lastCharBeforeMatch = template[matches.index - 1];
                    const shouldKeepWhitespace = lastCharBeforeMatch === '}';

                    let {whiteSpaceBefore, whiteSpaceAfter} = getWhiteSpaceBeforeAndAfter(line);

                    if(!shouldKeepWhitespace) {
                        whiteSpaceBefore = '';
                    }

                    const replaceValue = line.trim();

                    newLines.push(`${whiteSpaceBefore}{{${wrapWithTranslationFunction(replaceValue)}}}${whiteSpaceAfter}`);
                }

                if(!newLines.length) {
                    continue;
                }

                const replaceValue = newLines.join("\r\n");

                newContent = newContent.replace(replaceRegex, replaceValue);
            }
        }
        //#endregion

        //#region replace text in attributes
        while((matches = attributeRegex.exec(template)) !== null) {
            const match = matches[0];

            if(!isAttributeWhitelisted(matches[1])) {
                continue;
            }

            if(!match) {
                continue;
            }

            const trimmedMatch = match.trim();
            
            if(trimmedMatch.length === 0) {
                continue;
            }

            const transformed = replaceQuotedStringsByTranlation(match);

            if(match !== transformed) {
                newContent = newContent.replace(`"${match}"`, `"${transformed}"`);
            }
        }
        //#endregion

        if(fileContent !== newContent) {
            fs.writeFileSync(filePath, newContent);
            console.log('Replaced vue template text in:');
            console.log('- '+filePath);
        }
    }
}

function getWhiteSpaceBeforeAndAfter(value: string) {
    return {
        whiteSpaceBefore: /(^\s+)/.exec(value)?.[0] ?? '',
        whiteSpaceAfter: /(\s+$)/.exec(value)?.[0] ?? ''
    }
}

function isNumberOrSpecialCharacter(value: string) {
    return /(^-?\d+$)|(^-?[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~]+$)/.test(value);
}

function replaceQuotedStringsByTranlation(value: string): string {
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

function wrapWithTranslationFunction(value: string): string {
    let quoteType = "'";

    if(value.includes("'")) {
        quoteType = value.includes('"') ? '`' : '"';
    } else if(value.includes('"')) {
        quoteType = '`';
    }

    return `$t(${quoteType}${value}${quoteType})`;
}
