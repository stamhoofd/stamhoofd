// import chalk from "chalk";
// import { X2jOptions, XMLBuilder, XmlBuilderOptions, XMLParser } from "fast-xml-parser";
// import { addChangeMarkers, removeChangeMarkers } from "./git-html-helper";
// import { promptBoolean } from "./prompt-helper";
// import { getWhiteSpaceBeforeAndAfter, isNumberOrSpecialCharacter } from "./regex-helper";
// import { wrapWithTranslationFunction } from "./translation-helper";

// //#region html builder
// const builderOptions: XmlBuilderOptions = {
//     ignoreAttributes: false,
//     format: true,
//     preserveOrder: true,
//     suppressEmptyNode: true,
//     unpairedTags: ["hr", "br", "link", "meta", 'img'],
//     stopNodes : [ "*.pre", "*.script"],
//     processEntities: false,
//   }

// const htmlBuilder = new XMLBuilder(builderOptions);
// //#endregion

// //#region html parser
// const parsingOptions: X2jOptions = {
//     ignoreAttributes: false,
//     preserveOrder: true,
//     unpairedTags: ["hr", "br", "link", "meta", 'img'],
//     stopNodes : [ "*.pre", "*.script"],
//     processEntities: false,
//     allowBooleanAttributes: true
//     // htmlEntities: true,
//   };

// const parser = new XMLParser(parsingOptions);
// //#endregion



// export async function translateHtml(html: string, options: TranslateHtmlFileOptions = {}): Promise<string> {
//     /**
//      * todo:
//      * - get changes
//      * - check if changed line has
//      * - wrap changed lines with special tag
//      * - only process special tags
//      */

//     if(options.replaceChangesOnly) {
//         html = addChangeMarkers(options.replaceChangesOnly.filePath, html);
//     }
    
//     const object = parser.parse(html);

//     let source = object;
//     let parent = object;

//     options.path?.forEach((key) => {
//         if(options.skipKeys?.has(key)) {
//             return;
//         }

//         if(Array.isArray(source)) {
//             const item = source.find(object => Object.hasOwn(object, key));
//             if(item) {
//                 source = item[key];
//             }
//             return;
//         }

//         parent = source;
//         source = source[key];
//     });
    
//     if(Array.isArray(source)) {
//         await processArray(parent, source, options);
//     } else if(typeof source === 'object') {
//         await processRecord(parent, source, options);
//     }

//     const newHtml = htmlBuilder.build(source);

//     if(options.replaceChangesOnly) {
//         return removeChangeMarkers(newHtml);
//     }

//     return newHtml;
// }

// // async function processArray(parent: Record<string, any>, array: Record<string, any>[], options: TranslateHtmlFileOptions) {
// //     for(const item of array) {
// //         await processRecord(parent, item, options);
// //     }
// // }

// // async function processRecord(parent: Record<string, any>, record: Record<string, any>, options: TranslateHtmlFileOptions) {
// //     await processAttributes(parent, record, options);
// //     const firstEntry = Object.entries(record)[0];
// //     const [key, value] = firstEntry;

// //     if(options.skipKeys?.has(key)) {
// //         return;
// //     }

// //     if(value === null || value === undefined) {
// //         return;
// //     }

// //     if(key === '#text' && typeof value === 'string') {
// //         await processText(parent, record, key, options);
// //     }

// //     if(Array.isArray(value)) {
// //         await processArray(record, value, options);
// //     }
// // }

// // /**
// //  * 
// //  * @param parent the record of the parent tag
// //  * @param record text record
// //  * @param key text record key (#text)
// //  */
// // async function processText(parent: Record<string, any>, record: Record<string, string>, key: string, options: TranslateHtmlFileOptions) {
// //     const betweenBracketsRegex = /{{(?:.|\r|\n)*}}/g;
// //     const text = record[key];

// //     const parts = splitInParts(text, betweenBracketsRegex).map(item => {
// //         return {
// //             value: item.value,
// //             shouldTranslate: !item.isMatch
// //         }
// //     });

// //     // update text on record
// //     record[key] = await translateTextParts(parent, record, key, parts, translateText, options)
// // }

// function translateText(text: string) {
//     const trimmed = text.trim()

//     if(trimmed.length < 2) {
//         return text;
//     }

//     if(isNumberOrSpecialCharacter(trimmed)) {
//         return text;
//     }

//     const {whiteSpaceBefore, whiteSpaceAfter} = getWhiteSpaceBeforeAndAfter(text);

//     return `${whiteSpaceBefore}{{${wrapWithTranslationFunction(trimmed)}}}${whiteSpaceAfter}`
// }

// async function prompt(parent: Record<string, any>, record: Record<string, string>, key: string, part: string, translatedPart: string, processedParts: string, unprocessedPart: string, options: TranslateHtmlFileOptions): Promise<boolean> {
//     if(options.onBeforePrompt) {
//         options.onBeforePrompt();
//     }

//     logContext(parent, record, key, part, translatedPart, processedParts, unprocessedPart)
//     return await promptBoolean(chalk.yellow(`> Accept (press [y] or [enter])?`));
// }

// function replaceObjectWithPlaceholder(contextObject: any, copyObject: any, childObject: Record<string, string>, key: string): boolean {
//     if(contextObject === childObject) {
//         copyObject[key] = '#i18n-replace-text-placeholder';
//         return true;
//     }

//     if(typeof contextObject !== 'object') {
//         return false;
//     }

//     if(Array.isArray(contextObject)) {
//         for(let i = 0; i < contextObject.length; i++) {
//             if(replaceObjectWithPlaceholder(contextObject[i], copyObject[i], childObject, key)) {
//                 return true;
//             }
//         }

//         return false;
//     }

//     for(const objectKey of Object.keys(contextObject)) {
//         const value = contextObject[objectKey];
//         const valueCopy = copyObject[objectKey];
//         if(replaceObjectWithPlaceholder(value,valueCopy, childObject, key)) {
//             return true;
//         }
//     }

//     return false;
// }

// function deepCopy<T>(object: T): T {
//     return JSON.parse(JSON.stringify(object));
// }

// function getTextBeforeAndAfterChildHtmlObject(contextObject: Record<string, any>, childObject: Record<string, string>, key: string): [string, string] {
//     const placeholder = '#i18n-replace-text-placeholder';
//     const copyObject = deepCopy(contextObject);
//     const foundChildObject = replaceObjectWithPlaceholder(contextObject, copyObject, childObject, key);
//     if(!foundChildObject) {
//         throw new Error('Child object not found in context object.');
//     }

//     const context = htmlBuilder.build([copyObject]);
//     const parts = context.split(placeholder);
    
//     if(parts.length !== 2) {
//         throw new Error('Invalid context');
//     }

//     return parts;
// }

// function logContext(parent: Record<string, any>, record: Record<string, string>, key: string, part: string, translatedPart: string, processedParts: string, unprocessedPart: string) {
//     const [before, after] = getTextBeforeAndAfterChildHtmlObject(parent, record, key);

//     const maxContextLength = 500;
//     const completeContextBefore = before + processedParts;
//     const contextBefore = completeContextBefore.substring(completeContextBefore.length - maxContextLength);
//     const contextAfter = (unprocessedPart + after).substring(0, maxContextLength);

//     console.log(chalk.underline.white(`

// MATCH:`))
//     console.log(chalk.gray(contextBefore)+chalk.red(part)+chalk.gray(contextAfter));

//     console.log(chalk.underline.white(`
// REPLACEMENT:`))
//     console.log(chalk.gray(contextBefore)+chalk.green(translatedPart)+chalk.gray(contextAfter));

//     console.log(`
// `);
// }

// export async function processAttributes(parent: Record<string, any>, record: Record<string, any>, options: TranslateHtmlFileOptions) {
//     const key = ':@';
//     const value = record[key];

//     if(value === null || value === undefined) {
//         return;
//     }

//     const attributes = Object.entries(value);

//     for(const [attributeKey, attributeValue] of attributes) {

//         if(!attributeKey.startsWith('@_')) {
//             return;
//         }

//         const truncateStart = attributeKey.startsWith('@_:') ? 3 : 2;
//         const attributeName = attributeKey.substring(truncateStart);

//         if(options.attributeWhiteList && options.attributeWhiteList.has(attributeName)) {

//             if(typeof attributeValue === 'string') {
//                 value[attributeKey] = await replaceTextInTypescriptString(parent, value, attributeKey, attributeValue, options);
//             }
//         }
//     }
// }


// async function translateTextParts(parent: Record<string, any>, record: Record<string, string>, key: string, textParts: {value: string, shouldTranslate: boolean}[], translate: (text: string) => string, options: TranslateHtmlFileOptions) {

//     const processedParts: string[] = [];

//     const getUnprocessedpart = (i: number) => {
//         return textParts.slice(i + 1).map(t => t.value).join('');
//     }

//     for(let i = 0; i < textParts.length; i++) {
//         const {value, shouldTranslate} = textParts[i];

//         if(!shouldTranslate) {
//             processedParts.push(value);
//             continue;
//         }

//         const translatedPart = translate(value);
//         const isTranslated = translatedPart !== value;

//         const canTranslate = isTranslated && (!options.doPrompt || await prompt(parent, record, key, value, translatedPart, processedParts.join(''), getUnprocessedpart(i), options));

//         processedParts.push(canTranslate ? translatedPart : value);
//     }

//     return processedParts.join('');
// }

// function splitInParts(text: string, regex: RegExp): {isMatch: boolean, value: string}[] {
//     const matches = [...text.matchAll(regex)];
//     const startsWithMatch = matches[0]?.index === 0;
//     const matchedText = matches.map(match => match[0]);
//     const otherText = text.split(regex);

//     const results: {isMatch: boolean, value: string}[] = [];

//     for(let i = 0; i < otherText.length; i++) {
//         const part = otherText[i];

//         const matchedPart = matchedText[i];
//         if(startsWithMatch && matchedPart !== undefined) {
//             results.push({value: matchedPart, isMatch: true});
//         }

//         if(part !== undefined && part !== null && part.length > 0) {
//             results.push({value: part, isMatch: false});
//         }

//         if(!startsWithMatch && matchedPart !== undefined) {
//             results.push({value: matchedPart, isMatch: true});
//         }
//     }

//     return results;
// }

// // todo: move?
// async function replaceTextInTypescriptString(parent: Record<string, any>, record: Record<string, string>, key: string, value: string, options: TranslateHtmlFileOptions): Promise<string> {
//     const parts = splitInParts(value, /"([^"]*?)"|'([^']*?)'/ig);
//     const allParts: {value: string, shouldTranslate: boolean}[] = [];

//     for(let i = 0; i < parts.length; i++) {
//         const {value, isMatch} = parts[i];
//         if(!isMatch) {
//             allParts.push({
//                 value,
//                 shouldTranslate: false
//             });
//             continue;
//         }

//         const unquoted = value.slice(1, value.length - 1);
//         const trimmed = unquoted.trim();
        
//         if(trimmed.length === 0) {
//             allParts.push({
//                 value,
//                 shouldTranslate: false
//             });
//             continue;
//         }

//         // not possible to know if should be translated
//         const before = i === 0 ? '' : parts[i - 1].value;
//         const isArgument = before.endsWith('(');

//         if(isArgument) {
//             continue;
//         }

//         const isTranslated = before.endsWith('$t(') || before.startsWith('$t(');

//         if(isTranslated) {
//             allParts.push({
//                 value,
//                 shouldTranslate: false
//             });
//             continue;
//         }

//         const isEquality = ['==', '!=', '>=', '<='].some(item => before.endsWith(item + ' ') || before.endsWith(item));

//         if(isEquality) {
//             allParts.push({
//                 value,
//                 shouldTranslate: false
//             });
//             continue;
//         }

//         allParts.push({
//             value,
//             shouldTranslate: true
//         });
//     }

//     return await translateTextParts(parent, record, key, allParts, (value: string) => {
//         const unquoted = value.slice(1, value.length - 1);
//         const trimmed = unquoted.trim();
//         const {whiteSpaceBefore, whiteSpaceAfter} = getWhiteSpaceBeforeAndAfter(unquoted);
//         const quotedWhiteSpaceBefore = whiteSpaceBefore.length ? `"${whiteSpaceBefore}" + ` : '';
//         const quotedWhiteSpaceAfter = whiteSpaceAfter.length ? ` + "${whiteSpaceAfter}"` : '';
//         return quotedWhiteSpaceBefore + wrapWithTranslationFunction(trimmed) + quotedWhiteSpaceAfter;
//     }, options);
// }




