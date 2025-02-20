import fs from "fs";
import { getFilesToSearch } from "./get-files-to-search";
import { getChangedFiles, getDiffChunks } from "./git-helper";
import { escapeRegExp, getIndexOfFirstNewLine, getIndexOfLastNewLine, getWhiteSpaceBeforeAndAfter, isNumberOrSpecialCharacter } from "./regex-helper";
import { replaceTextInTypescriptString } from "./replace-text-typescript";
import { wrapWithTranslationFunction } from "./translation-helper";

/**
 * todo:
 * - expand whitelist
 */

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

export function replaceAllVueTemplateText({replaceChangesOnly = true}: {replaceChangesOnly?: boolean} = {}) {
    const files = getFilesToSearch(['vue']);

    if(replaceChangesOnly) {
        const changedFiles = getChangedFiles('vue');
        
        for (const filePath of files) {
            if(changedFiles.has(filePath)) {
                replaceVueTemplateText(filePath, {replaceChangesOnly});
            }
        }
        return;
    }

    for (const filePath of files) {
        replaceVueTemplateText(filePath, {replaceChangesOnly});
    }
}

export function replaceVueTemplateText(filePath: string, {replaceChangesOnly = true}: {replaceChangesOnly?: boolean} = {}) {
    console.log('Try translate vue template text in:', filePath);
    const fileContent = fs.readFileSync(filePath, "utf8");

    const diffChunks = replaceChangesOnly ? getDiffChunks(filePath) : [];
    if(replaceChangesOnly && diffChunks.length === 0) {
        return;
    }

    const allNewLines = diffChunks.flatMap(x => x.newLineValues);
    let newContent = fileContent;

    const templateArray = templateRegex.exec(fileContent);
    if(templateArray === null) {
        return;
    }
    const template = templateArray[1]
    if(template === null) {
        return;
    }

    let matches: RegExpExecArray | null;

    //#region replace text
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

        const matchIndex = matches.index;
        const replaceRegex = new RegExp(`(?<=<.*(\\w|"|')>|}})${escapeRegExp(match)}(?=<.*\/.+.?>|{{)`, 'ig');

        let newLines: string[] = [];
        const lines = match.split(/\r|\n/);

        if(replaceChangesOnly) {
            const hasChanges = isSomeLineChanged(match, matchIndex, template, lines, allNewLines);

            if(!hasChanges) {
                continue;
            }
        }

        // todo: check if one of the lines is changed
        for(const line of lines) {
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

        if(replaceChangesOnly) {
            const isMatchChanged = allNewLines.some(line => line.includes(match));

            if(!isMatchChanged) {
                continue;
            }
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
    //#endregion

    if(fileContent !== newContent) {
        fs.writeFileSync(filePath, newContent);
        console.log('-> translated text');
    }
}

function isSomeLineChanged(match: string, matchIndex: number, template: string,lines: string[], allNewLines: string[]) {
    const startIndex = getIndexOfLastNewLine(template.substring(0, matchIndex)) + 1;
    const startOfLine = template.substring(startIndex, matchIndex);
    const endIndex = startIndex + startOfLine.length + match.length + Math.max(0, getIndexOfFirstNewLine(template.substring(matchIndex + match.length)));

    const endOfLine = template.substring(matchIndex + match.length, endIndex);

    const isSomeLineChanged = lines.some((line, index) => {
        let value = line;

        if(index === 0) {
            value = startOfLine + value;
        }

        if (index === lines.length - 1) {
            value = value + endOfLine;
        }

        return  allNewLines.includes(value);
    });

    return isSomeLineChanged;
}

/**
 * Todo: keep track of declined translations
 * for each file -> begin and end index after previous change OR line number after previous change?
 * 
 * Keep track of last commit
 */
