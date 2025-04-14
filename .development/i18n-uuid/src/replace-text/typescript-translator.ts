import chalk from "chalk";
import { removeChangeMarkers } from "./git-html-helper";
import { promptBoolean } from "./prompt-helper";
import { getWhiteSpaceBeforeAndAfter, splitInParts } from "./regex-helper";
import { shouldTranslateTypescriptString } from "./should-translate-typescript-string";
import { wrapWithTranslationFunction } from "./translation-helper";

export interface TypescriptTranslatorOptions {
    path?: string[];
    doPrompt?: boolean;
    onBeforePrompt?: () => void;
    replaceChangesOnly?: {
        filePath: string;
        commitsToCompare?: [string, string];
    };
    totalProgress?: {
        current: number;
        total: number;
    };
    fileProgress?: {
        current: number;
        total: number;
    };
}

export class TypescriptTranslator {
    private readonly shouldCheckChanges: boolean;
    private readonly fileProgressText: string;
    private isChanged = false;
    private _currentMatchCount = 0;
    private totalMatchCount = 0;

    get currentMatchCount() {
        return this._currentMatchCount;
    }

    constructor(readonly options: TypescriptTranslatorOptions = {}) {
        this.shouldCheckChanges = this.options.replaceChangesOnly !== undefined;
        this.fileProgressText = options.fileProgress
            ? chalk.gray(" File ") +
              chalk.white(
                  `${options.fileProgress.current} / ${options.fileProgress.total}`,
              )
            : "";
    }

    async getTotalMatchCount(html: string): Promise<number> {
        const copyTranslator = new TypescriptTranslator({...this.options, doPrompt: false});
        await copyTranslator.translate(html);
        return copyTranslator.currentMatchCount;
    }

    async translate(text: string): Promise<string> {
        // todo: translate human/message in SimpleError
        // todo: find other text that needs translation?

        // in vue text: Toast

        // use blacklist and loop every string, except if already translated

        this._currentMatchCount = 0;
        this.isChanged = false;

        if(this.options.doPrompt) {
            this.totalMatchCount = await this.getTotalMatchCount(text);
        }

        // todo
        if(this.shouldCheckChanges) {
            throw new Error('Option shouldCheckChanges is not implemented.')
        }

        const parts = splitInPartsIgnoreComments(text);
        const allParts: {value: string, shouldTranslate: boolean}[] = [];

        for(let i = 0; i < parts.length; i++) {
            const {value, isMatch} = parts[i];
            if(!isMatch) {
                allParts.push({
                    value,
                    shouldTranslate: false
                });
                continue;
            }
    
            const unquoted = value.slice(1, value.length - 1);
            const trimmed = unquoted.trim();
            
            if(trimmed.length < 2) {
                allParts.push({
                    value,
                    shouldTranslate: false
                });
                continue;
            }

            const before = i === 0 ? '' : parts[i - 1].value;
            const beforeTrimmedEnd = before.trimEnd();
    
            const isTranslated = before.endsWith('$t(') || before.startsWith('$t(');
    
            if(isTranslated) {
                allParts.push({
                    value,
                    shouldTranslate: false
                });
                continue;
            }

            const isImport = beforeTrimmedEnd.endsWith(' from');
            if(isImport) {
                allParts.push({
                    value,
                    shouldTranslate: false
                });
                continue;
            }
    
            const isEquality = ['==', '!=', '>=', '<=', '<', '>'].some(item => beforeTrimmedEnd.endsWith(item));
    
            if(isEquality) {
                allParts.push({
                    value,
                    shouldTranslate: false
                });
                continue;
            }

            const shouldTranslate = shouldTranslateTypescriptString(allParts, value);
    
            allParts.push({
                value,
                shouldTranslate
            });
        }

        return await this.translateTextParts(allParts, (value: string) => {
            const unquoted = value.slice(1, value.length - 1);
            const trimmed = unquoted.trim();
            const quoteType = "'";
            const {whiteSpaceBefore, whiteSpaceAfter} = getWhiteSpaceBeforeAndAfter(unquoted);
            const quotedWhiteSpaceBefore = whiteSpaceBefore.length ? `${quoteType}${whiteSpaceBefore}${quoteType} + ` : '';
            const quotedWhiteSpaceAfter = whiteSpaceAfter.length ? ` + ${quoteType}${whiteSpaceAfter}${quoteType}` : '';
            return quotedWhiteSpaceBefore + wrapWithTranslationFunction(trimmed, ['"']) + quotedWhiteSpaceAfter;
        });
    }

    private async translateTextParts(textParts: {value: string, shouldTranslate: boolean}[], translate: (text: string) => string) {

        const processedParts: string[] = [];
    
        const getUnprocessedpart = (i: number) => {
            return textParts.slice(i + 1).map(t => t.value).join('');
        }
    
        for(let i = 0; i < textParts.length; i++) {
            const {value, shouldTranslate} = textParts[i];
    
            if(!shouldTranslate) {
                processedParts.push(value);
                continue;
            }
    
            const translatedPart = translate(value);
            const isTranslated = translatedPart !== value;

            if(isTranslated) {
                this._currentMatchCount = this._currentMatchCount + 1;
            }
    
            const canTranslate = isTranslated && (!this.options.doPrompt || await this.prompt(value, translatedPart, processedParts.join(''), getUnprocessedpart(i)));

            if(canTranslate) {
                this.isChanged = true;
            }
    
            processedParts.push(canTranslate ? translatedPart : value);
        }
    
        return processedParts.join('');
    }

    private async prompt(part: string, translatedPart: string, processedParts: string, unprocessedPart: string): Promise<boolean> {
        if(this.options.onBeforePrompt) {
            this.options.onBeforePrompt();
        }
    
        this.logContext(part, translatedPart, processedParts, unprocessedPart);
        return await promptBoolean(chalk.yellow(`> Accept (press [y] or [enter])?`));
    }

    private logContext(part: string, translatedPart: string, processedParts: string, unprocessedPart: string) {
        const maxContextLength = 100;
        const completeContextBefore = processedParts;
        let contextBefore = completeContextBefore.substring(completeContextBefore.length - maxContextLength);
        let contextAfter = removeChangeMarkers((unprocessedPart)).substring(0, maxContextLength);

        console.log(chalk.underline.white(`
MATCH:`))
        console.log(chalk.gray(contextBefore)+chalk.red(part)+chalk.gray(contextAfter));
    
        console.log(chalk.underline.white(`
REPLACEMENT:`))
        console.log(chalk.gray(contextBefore)+chalk.green(translatedPart)+chalk.gray(contextAfter));
    
        console.log(`
`);
        const totalProgress = this.options.totalProgress;
        const totalProgressText = totalProgress ? chalk.gray(' Total ') + chalk.white(`${totalProgress.current + this._currentMatchCount} / ${totalProgress.total}`) : '';

        console.log(chalk.gray('Match ') +chalk.white(`${this._currentMatchCount} / ${this.totalMatchCount}` )+ chalk.gray(this.fileProgressText) + chalk.gray(totalProgressText));
    }
}

function splitInPartsIgnoreComments(text: string): {isMatch: boolean, value: string}[] {
    const splittedByComments = splitInParts(text, /\/\*[\s\S]*?\*\/|(?:[^\\:]|^)\/\/.*$/gm);

    return splittedByComments.flatMap(({value, isMatch}) => {
        if(isMatch) {
            return {isMatch: false, value}
        }

        return splitInParts(value, /"(?:[^"]*?)"|'(?:[^']*?)'/ig);
    })
}

export async function translateTypescript(html: string, options: TypescriptTranslatorOptions = {}) {
    const translator = new TypescriptTranslator(options);
    return translator.translate(html);
}

export async function getTotalMatchCount(html: string, options: TypescriptTranslatorOptions = {}) {
    const translator = new TypescriptTranslator(options);
    return translator.getTotalMatchCount(html);
}
