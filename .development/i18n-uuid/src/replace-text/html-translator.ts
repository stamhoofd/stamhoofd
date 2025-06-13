import chalk from "chalk";
import { X2jOptions, XMLBuilder, XmlBuilderOptions, XMLParser } from "fast-xml-parser";
import { promptYesNoOrDoubt, YesNoOrDoubt } from "../shared/prompt-helper";
import { addChangeMarkers, endChangeMarker, removeChangeMarkers, startChangeMarker } from "./git-helper";
import { getWhiteSpaceBeforeAndAfter, isNumberOrSpecialCharacter, splitInParts } from "./regex-helper";
import { wrapWithTranslationFunction } from "./translation-helper";

export interface HtmlTranslatorOptions {
    path?: string[],
    doPrompt?: boolean,
    skipKeys?: Set<string>,
    attributeWhiteList?: Set<string>,
    onBeforePrompt?: () => void,
    onPromptDoubt?: () => void;
    replaceChangesOnly?: {
        filePath: string,
        commitsToCompare?: [string, string]
    };
    totalProgress?: {
        current: number,
        total: number
    },
    fileProgress?: {
        current: number,
        total: number
    }
}

type HtmlTranslatorContext = {
    before: string;
    after: string;
}

const unpairedTags = ["hr", "br", "link", "meta", 'img','input'];
const unpairedTagsSet = new Set(unpairedTags);

export class HtmlTranslator {
    private readonly htmlBuilder: XMLBuilder;
    private readonly htmlParser: XMLParser;
    private areCurrentLinesChanged = false;
    private isChanged = false;
    private _currentMatchCount = 0;
    private totalMatchCount = 0;
    private static readonly PLACEHOLDER = '[[html-translator-placeholder]]';
    private readonly shouldCheckChanges: boolean;
    private readonly fileProgressText: string;
    private _isDoubt = false;

    get currentMatchCount() {
        return this._currentMatchCount;
    }

    constructor(readonly options: HtmlTranslatorOptions = {}) {
        this.htmlBuilder = this.initHtmlBuilder();
        this.htmlParser = this.initHtmlParser();
        this.shouldCheckChanges = this.options.replaceChangesOnly !== undefined;
        this.fileProgressText = options.fileProgress ? chalk.gray(' File ') + chalk.white(`${options.fileProgress.current} / ${options.fileProgress.total}`) : '';
    }

    async getTotalMatchCount(html: string): Promise<number> {
        const copyTranslator = new HtmlTranslator({...this.options, doPrompt: false});
        await copyTranslator.translate(html);
        return copyTranslator.currentMatchCount;
    }

    async translate(html: string): Promise<string> {
        this._currentMatchCount = 0;
        this.isChanged = false;

        if(this.options.doPrompt) {
            this.totalMatchCount = await this.getTotalMatchCount(html);
        }

        const originalHtml = html;
        if(this.shouldCheckChanges) {
            const {filePath, commitsToCompare} = this.options.replaceChangesOnly!;
            html = addChangeMarkers(filePath, html, commitsToCompare);
        } else {
            this.areCurrentLinesChanged = true;
        }
        
        const object = this.htmlParser.parse(html);
        this.fixUnpairedTagBug(object, null);

        let source = object;
        let parent = object;

        this.options.path?.forEach((key) => {
            if(this.options.skipKeys?.has(key)) {
                return;
            }

            if(Array.isArray(source)) {
                const item = source.find(object => Object.hasOwn(object, key));
                if(item) {
                    source = item[key];
                }
                return;
            }

            parent = source;
            source = source[key];
        });
        
        if(Array.isArray(source)) {
            await this.processArray(parent, source);
        } else if(typeof source === 'object') {
            await this.processRecord(parent, source);
        }

        if(this._isDoubt || !this.isChanged) {
            return originalHtml;
        }

        const newHtml = this.htmlBuilder.build(source);

        if(this.shouldCheckChanges) {
            return removeChangeMarkers(newHtml);
        }

        return newHtml; 
    }

    private initHtmlBuilder(): XMLBuilder {
        const builderOptions: XmlBuilderOptions = {
            ignoreAttributes: false,
            format: false,
            preserveOrder: true,
            suppressEmptyNode: true,
            unpairedTags,
            stopNodes : [ "*.pre", "*.script"],
            processEntities: false,
          }
        
        return new XMLBuilder(builderOptions);
    }

    private initHtmlParser(): XMLParser {
        const parsingOptions: X2jOptions = {
            ignoreAttributes: false,
            preserveOrder: true,
            unpairedTags,
            stopNodes : [ "*.pre", "*.script"],
            processEntities: false,
            allowBooleanAttributes: true,
            trimValues: false
            // htmlEntities: true,
          };
        
        return new XMLParser(parsingOptions);
    }

    /**
     * the fast-xml-parser library has a bug where it doesn't process unpaired tags properly
     * for example, the text after <br> will be lost
     * @param object 
     * @param parent 
     */
    private fixUnpairedTagBug(object: any, parent: any | null) {
        if(Array.isArray(object)) {
            object.forEach((item) => {
                this.fixUnpairedTagBug(item, object);
            });
        } else if(typeof object === 'object') {
            for(const [key, value] of Object.entries(object)) {
                // if unpaired tag element
                if(unpairedTagsSet.has(key)) {
                    // find array with #text and move text after unpaired tag
                    if(Array.isArray(value)) {
                        for(const item of value) {
                            if(typeof item === 'object') {
                                for(const [childKey, childValue] of Object.entries(item)) {
                                    if(childKey === '#text' && typeof childValue === 'string') {
                                        if(parent && Array.isArray(parent)) {
                                            // move new text element after unpaired tag
                                            const index = parent.indexOf(object);
                                            const newElement = {
                                                '#text': childValue
                                            };
                                            parent.splice(index + 1, 0, newElement);
                                        }

                                        break;
                                    }
                                }
                            }
                        }
                    }
                } else {
                    this.fixUnpairedTagBug(value, object);
                }
            }
        }
    }

    private async processArray(parent: Record<string, any>, array: Record<string, any>[]) {
        for(const item of array) {
            await this.processRecord(parent, item);
        }
    }

    private async processRecord(parent: Record<string, any>, record: Record<string, any>) {
        await this.processAttributes(parent, record);
        const firstEntry = Object.entries(record)[0];
        const [key, value] = firstEntry;
    
        if(this.options.skipKeys?.has(key)) {
            return;
        }
    
        if(value === null || value === undefined) {
            return;
        }
    
        if(key === '#text' && typeof value === 'string') {
            await this.processText(parent, record, key);
        }
    
        if(Array.isArray(value)) {
            await this.processArray(record, value);
        }
    }

    /**
     * 
     * @param parent the record of the parent tag
     * @param record text record
     * @param key text record key (#text)
     */
    private async processText(parent: Record<string, any>, record: Record<string, string>, key: string) {
        const betweenBracketsRegex = /{{(?:.|\r|\n)*}}/g;
        const text: string | null = this.setIsChangedAndRemoveMarkers(record[key]);

        if(text !== null) {
            const parts = splitInParts(text, betweenBracketsRegex).map(item => {
                return {
                    value: item.value,
                    shouldTranslate: !item.isMatch
                }
            });
        
            // update text on record
            record[key] = await this.translateTextParts(parent, record, key, text, parts, this.translateText)
        }
    }

    private translateText(text: string) {
        const trimmed = text.trim()
    
        if(trimmed.length < 2) {
            return text;
        }
    
        if(isNumberOrSpecialCharacter(trimmed)) {
            return text;
        }
    
        const {whiteSpaceBefore, whiteSpaceAfter} = getWhiteSpaceBeforeAndAfter(text);
    
        return `${whiteSpaceBefore}{{ ${wrapWithTranslationFunction(trimmed)} }}${whiteSpaceAfter}`
    }

    private async prompt(parent: Record<string, any>, record: Record<string, string>, key: string, part: string, translatedPart: string, processedParts: string, unprocessedPart: string, transformContext?: (context: HtmlTranslatorContext) => HtmlTranslatorContext): Promise<boolean> {
        if(this.options.onBeforePrompt) {
            this.options.onBeforePrompt();
        }
    
        this.logContext(parent, record, key, part, translatedPart, processedParts, unprocessedPart, transformContext);
        const result = await promptYesNoOrDoubt(chalk.yellow(`> Accept (press [y] or [enter])?`));

        if(result === YesNoOrDoubt.Yes) {
            return true;
        }

        if(result === YesNoOrDoubt.Doubt && this.options.onPromptDoubt) {
            this._isDoubt = true;
            this.options.onPromptDoubt();
        }

        return false;
    }

    private replaceObjectWithPlaceholder(contextObject: any, copyObject: any, childObject: Record<string, string>, key: string): boolean {
        if(contextObject === childObject) {
            copyObject[key] = HtmlTranslator.PLACEHOLDER;
            return true;
        }
    
        if(typeof contextObject !== 'object') {
            return false;
        }
    
        if(Array.isArray(contextObject)) {
            for(let i = 0; i < contextObject.length; i++) {
                if(this.replaceObjectWithPlaceholder(contextObject[i], copyObject[i], childObject, key)) {
                    return true;
                }
            }
    
            return false;
        }
    
        for(const objectKey of Object.keys(contextObject)) {
            const value = contextObject[objectKey];
            const valueCopy = copyObject[objectKey];
            if(this.replaceObjectWithPlaceholder(value,valueCopy, childObject, key)) {
                return true;
            }
        }
    
        return false;
    }

    private deepCopy<T>(object: T): T {
        return JSON.parse(JSON.stringify(object));
    }

    private getTextBeforeAndAfterChildHtmlObject(contextObject: Record<string, any>, childObject: Record<string, string>, key: string): [string, string] {
        const placeholder = HtmlTranslator.PLACEHOLDER;
        const copyObject = this.deepCopy(contextObject);
        const foundChildObject = this.replaceObjectWithPlaceholder(contextObject, copyObject, childObject, key);
        if(!foundChildObject) {
            throw new Error('Child object not found in context object.');
        }
    
        const context = this.htmlBuilder.build([copyObject]);
        const parts = context.split(placeholder);
        
        if(parts.length !== 2) {
            throw new Error('Invalid context: ' + context);
        }
    
        return parts as [string, string];
    }

    private logContext(parent: Record<string, any>, record: Record<string, string>, key: string, part: string, translatedPart: string, processedParts: string, unprocessedPart: string, transformContext?: (context: HtmlTranslatorContext) => HtmlTranslatorContext) {
        const [before, after] = this.getTextBeforeAndAfterChildHtmlObject(parent, record, key);
    
        const maxContextLength = 100;
        const completeContextBefore = before + processedParts;
        let contextBefore = completeContextBefore.substring(completeContextBefore.length - maxContextLength);
        let contextAfter = removeChangeMarkers((unprocessedPart + after)).substring(0, maxContextLength);

        console.log(chalk.underline.white(`
MATCH:`))
        console.log(chalk.gray(contextBefore)+chalk.red(part)+chalk.gray(contextAfter));

        if(transformContext) {
            const newContext = transformContext({before: contextBefore, after: contextAfter});
            contextBefore = newContext.before;
            contextAfter = newContext.after;
        }
    
        console.log(chalk.underline.white(`
REPLACEMENT:`))
        console.log(chalk.gray(contextBefore)+chalk.green(translatedPart)+chalk.gray(contextAfter));
    
        console.log(`
`);
        const totalProgress = this.options.totalProgress;
        const totalProgressText = totalProgress ? chalk.gray(' Total ') + chalk.white(`${totalProgress.current + this._currentMatchCount} / ${totalProgress.total}`) : '';

        console.log(chalk.gray('Match ') +chalk.white(`${this._currentMatchCount} / ${this.totalMatchCount}` )+ chalk.gray(this.fileProgressText) + chalk.gray(totalProgressText));
    }

    private async processAttributes(parent: Record<string, any>, record: Record<string, any>) {
        const key = ':@';
        const value = record[key];
    
        if(value === null || value === undefined) {
            return;
        }
    
        const attributes = Object.entries(value);
    
        for(let [attributeKey, attributeValue] of attributes) {
            this.checkIsStartOrEndChange(attributeKey);
            let isChanged = this.areCurrentLinesChanged;

            if(typeof attributeValue === 'string') {
                attributeValue = this.setIsChangedAndRemoveMarkers(attributeValue);
                if(attributeValue !== null) {
                    isChanged = true;
                }
            }
    
            if(isChanged && attributeKey.startsWith('@_')) {
                const isReactive = attributeKey.startsWith('@_:');
                const attributeName = attributeKey.substring(isReactive? 3 : 2);
        
                if(this.options.attributeWhiteList && this.options.attributeWhiteList.has(attributeName)) {
        
                    if(typeof attributeValue === 'string') {
                        if(isReactive) {
                            value[attributeKey] = await this.replaceTextInTypescript(parent, value, attributeKey, attributeValue);
                        } else {
                            const newValue = await this.replaceTextInNonReactiveAttributeValue(parent, value, attributeKey, attributeValue, attributeName);
                            if(attributeValue !== newValue) {
                                value[attributeKey] = newValue;
                                
                                // make the attribute reactive
                                const newKey = attributeKey.replace('@_', '@_:')
                                const propertyDescriptor = Object.getOwnPropertyDescriptor(value, attributeKey);
                                if(propertyDescriptor) {
                                    Object.defineProperty(value, newKey, propertyDescriptor);
                                    delete value[attributeKey];
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private checkIsStartOrEndChange(value: string): void {
        this.checkIsStartChange(value);
        this.checkIsEndChange(value);
    }

    private checkIsStartChange(value: string): boolean {
        if(this.shouldCheckChanges && value.includes(startChangeMarker)) {
            this.areCurrentLinesChanged = true;
            return true;
        }

        return false;
    }

    private checkIsEndChange(value: string): boolean {
        if(this.shouldCheckChanges && value.includes(endChangeMarker)) {
            this.areCurrentLinesChanged = false;
            return true;
        }

        return false;
    }

    private setIsChangedAndRemoveMarkers(value: string): string | null {
        const startIndex = value.indexOf(startChangeMarker);
        const endIndex = value.indexOf(endChangeMarker);
        const originalIsChanged = this.areCurrentLinesChanged;

        if(startIndex === -1) {
            if(endIndex === -1) {
                if(originalIsChanged) {
                    return value;
                }
    
                return null;
            }

            this.areCurrentLinesChanged = false;

            // should not translate if the marker is at the beginning
            if(endIndex === 0) {
                return null;
            }

            if(originalIsChanged) {
                return value.replace(endChangeMarker, '')
            }

            return null;
        }

        if(endIndex === -1) {
            this.areCurrentLinesChanged = true;
            return value.replace(startChangeMarker, '');
        }

        this.areCurrentLinesChanged = startIndex > endIndex;
        return value.replace(startChangeMarker, '').replace(endChangeMarker, '')
    }

    private async translateTextParts(parent: Record<string, any>, record: Record<string, string>, key: string, original: string, textParts: {value: string, shouldTranslate: boolean}[], translate: (text: string) => string, transformContext?: (context: HtmlTranslatorContext) => HtmlTranslatorContext) {

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
    
            const canTranslate = isTranslated && (!this.options.doPrompt || await this.prompt(parent, record, key, value, translatedPart, processedParts.join(''), getUnprocessedpart(i), transformContext));
            if(this._isDoubt) {
                return original;
            }

            if(canTranslate) {
                this.isChanged = true;
            }
    
            processedParts.push(canTranslate ? translatedPart : value);
        }
    
        return processedParts.join('');
    }

    private async replaceTextInNonReactiveAttributeValue(parent: Record<string, any>, record: Record<string, string>, key: string, value: string, attributeName: string): Promise<string> {
        const allParts: {value: string, shouldTranslate: boolean}[] = [{
            value,
            shouldTranslate: value !== undefined && value.trim().length > 0
        }];
    
        return await this.translateTextParts(parent, record, key, value, allParts, (value: string) => {
            return wrapWithTranslationFunction(value, ['"']);
        }, context => {

            const insertIndex = attributeName.length + 2;
            const toInsert = ':';
            const before = context.before.substring(0, context.before.length - insertIndex) + chalk.green(toInsert) + context.before.substring(context.before.length - insertIndex);

            return {
                ...context,
                before 
            }
        });
    }

    private async replaceTextInTypescript(parent: Record<string, any>, record: Record<string, string>, key: string, value: string): Promise<string> {
        const parts = splitInParts(value, /"(?:[^"]*?)"|'(?:[^']*?)'/ig);
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
            
            if(trimmed.length === 0) {
                allParts.push({
                    value,
                    shouldTranslate: false
                });
                continue;
            }
    
            // not possible to know if should be translated
            const before = i === 0 ? '' : parts[i - 1].value;
            const isArgument = before.endsWith('(');
    
            if(isArgument) {
                allParts.push({
                    value,
                    shouldTranslate: false
                });
                continue;
            }
    
            const isTranslated = before.endsWith('$t(') || before.startsWith('$t(');
    
            if(isTranslated) {
                allParts.push({
                    value,
                    shouldTranslate: false
                });
                continue;
            }
    
            const isEquality = ['==', '!=', '>=', '<='].some(item => before.endsWith(item + ' ') || before.endsWith(item));
    
            if(isEquality) {
                allParts.push({
                    value,
                    shouldTranslate: false
                });
                continue;
            }
    
            allParts.push({
                value,
                shouldTranslate: true
            });
        }
    
        return await this.translateTextParts(parent, record, key, value, allParts, (value: string) => {
            const unquoted = value.slice(1, value.length - 1);
            const trimmed = unquoted.trim();
            const quoteType = "'";
            const {whiteSpaceBefore, whiteSpaceAfter} = getWhiteSpaceBeforeAndAfter(unquoted);
            const quotedWhiteSpaceBefore = whiteSpaceBefore.length ? `${quoteType}${whiteSpaceBefore}${quoteType} + ` : '';
            const quotedWhiteSpaceAfter = whiteSpaceAfter.length ? ` + ${quoteType}${whiteSpaceAfter}${quoteType}` : '';
            return quotedWhiteSpaceBefore + wrapWithTranslationFunction(trimmed, ['"']) + quotedWhiteSpaceAfter;
        });
    }
}

export async function translateHtml(html: string, options: HtmlTranslatorOptions = {}) {
    const translator = new HtmlTranslator(options);
    return translator.translate(html);
}

export async function getTotalMatchCount(html: string, options: HtmlTranslatorOptions = {}) {
    const translator = new HtmlTranslator(options);
    return translator.getTotalMatchCount(html);
}
