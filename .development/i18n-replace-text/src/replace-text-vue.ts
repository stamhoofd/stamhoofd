import chalk from "chalk";
import fs from "fs";
import { getFilesToSearch } from "./get-files-to-search";
import { getChangedFiles, getDiffChunks } from "./git-helper";
import { promptBoolean } from "./prompt-helper";
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

// const testRegex = /(?:<((\w|\d)+).*?>)(?:(.|\n)*)(?:<\/\1>)/ig;
// const testRegex = /(?:<((\w|\d)+)(.|\r|\n)*?>)(?:(.|\n)*)(?:<\/\1\s*>)/gi;
const regex = /(?:<((?:\w|\d)+)(?:.|\r|\n)*?>)((?:.|\n)*)(?:<\/\1\s*>)/ig;

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

interface Options {
    replaceChangesOnly?: boolean;
    doPrompt?: boolean;
}

export async function replaceAllVueTemplateText(options: Options = {}) {
    const files = getFilesToSearch(['vue']);

    if(options.replaceChangesOnly) {
        const changedFiles = getChangedFiles('vue');
        
        for (const filePath of files) {
            if(changedFiles.has(filePath)) {
                await replaceVueTemplateText(filePath, options);
            }
        }
        return;
    }

    for (const filePath of files) {
        replaceVueTemplateText(filePath, options);
    }
}

export async function replaceVueTemplateText(filePath: string, {replaceChangesOnly = true, doPrompt = true}: Options = {}) {
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
    while ((matches = vueTemplateTextRegex.exec(newContent)) !== null) {
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

        // todo: only replace 1 match? from index
        const replacedContent = newContent.replace(replaceRegex, replaceValue);
        // const originalReplacedContent = template.replace(replaceRegex, replaceValue);

        if(!doPrompt || await isAccepted(getContext(replacedContent, replaceValue, matchIndex), getRegExpExecContext(matches))) {
            newContent = replacedContent;
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

function getRegExpExecContext(execArray: RegExpExecArray, {lines = 5}: {lines?: number} = {}) {
    const match = execArray[0];
    const matchIndex = execArray.index;

    return getContext(execArray.input, match, matchIndex, lines);
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

interface LineContext {
    before: string;
    value: string;
    after: string;
}

function getContext(completeString: string, value: string, startIndex: number, lines: number = 5): LineContext {
    const endIndex = startIndex + value.length;

    let currentStartIndex = startIndex;
    let linesBeforeLeft = lines;

    while(linesBeforeLeft > 0) {
        linesBeforeLeft = linesBeforeLeft - 1;
        currentStartIndex = getIndexOfLastNewLine(completeString.substring(0, currentStartIndex));

        if(currentStartIndex < 0) {
            linesBeforeLeft = 0;
            currentStartIndex = 0;
        }
    }

    let currentEndIndex = endIndex;
    let linesAfterLeft = lines;

    while(linesAfterLeft > 0) {
        linesAfterLeft = linesAfterLeft - 1;
        currentEndIndex = currentEndIndex + getIndexOfFirstNewLine(completeString.substring(currentEndIndex));

        if(currentEndIndex >= completeString.length) {
            linesAfterLeft = 0;
            currentEndIndex = completeString.length;
        }
    }

    return {
        before: completeString.substring(currentStartIndex, startIndex),
        value: completeString.substring(startIndex, endIndex),
        after: completeString.substring(endIndex, currentEndIndex)
    }
}

async function isAccepted(contextAfter: LineContext, contextBefore: LineContext) {
    console.log(chalk.underline.white(`

MATCH:`))

    console.log(chalk.gray(contextBefore.before)+chalk.red(contextBefore.value)+chalk.gray(contextBefore.after));


    console.log(chalk.underline.white(`
REPLACEMENT:`))

    console.log(chalk.gray(contextAfter.before)+chalk.green(contextAfter.value)+chalk.gray(contextAfter.after));
    console.log(`
`);

    return await promptBoolean(chalk.yellow(`> Accept (y or enter to accept)?`));
}

/**
 * Todo: keep track of declined translations
 * for each file -> begin and end index after previous change OR line number after previous change?
 * 
 * Keep track of last commit
 */
