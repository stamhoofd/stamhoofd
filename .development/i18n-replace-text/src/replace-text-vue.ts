import fs from "fs";
import { getFilesToSearch } from "./get-files-to-search";
import { escapeRegExp, getWhiteSpaceBeforeAndAfter, isNumberOrSpecialCharacter } from "./regex-helper";
import { replaceTextInTypescript } from "./replace-text-typescript";
import { wrapWithTranslationFunction } from "./translation-helper";

const vueTemplateTextRegex = /(?<=<.*(\w|"|')>|}})(?:\w|\d|\n|\s|\\n|[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~])+?(?:\w|\d|\n|\s|\\n|[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~])+?(?=<.*\/.+.?>|{{)/ig;
const attributeRegex = /(?<=(:[^ ().,:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~]+=")).*?(?=")/ig;


const templateRegex = /<template>((.|\n)+)<\/template>/;

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

            const transformed = replaceTextInTypescript(match);

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
