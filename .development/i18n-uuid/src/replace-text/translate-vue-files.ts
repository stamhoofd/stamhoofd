import chalk from "chalk";
import fs from "fs";
import { getFilesToSearch } from "../shared/get-files-to-search";
import { eslintFormatter } from "./eslint-formatter";
import { fileCache } from "./FileCache";
import { getChangedFiles } from "./git-helper";
import { getVueTemplateMatchCount, TranslateVueFileOptions, translateVueTemplate } from "./translate-vue-template";
import { getTotalMatchCount, translateTypescript, TypescriptTranslatorOptions } from "./typescript-translator";

interface TranslateVueFilesOptions {
    replaceChangesOnly?: boolean;
    doPrompt?: boolean;
    doFix?: boolean;
    dryRun?: boolean;

    commitsToCompare?: [string, string];
    attributeWhiteList?: Set<string>;
}

const attributeWhiteList = new Set([
    'placeholder',
    'label',
    'title',
    'text',
    'empty-message'
]);

export async function translateVueFiles(options: TranslateVueFilesOptions = {}) {
    const files = getFilesToSearch(['vue']).filter(filePath => !fileCache.hasFile(filePath));
    let filesToLoop: string[];

    if(options.replaceChangesOnly) {
        const changedFiles = getChangedFiles('vue', {compare: options.commitsToCompare});
        filesToLoop = files.filter(filePath => changedFiles.has(filePath));
    } else {
        filesToLoop = files;
    }

    if(options.doPrompt) {
        const filesWithChangeInfo = await getMatchInfo(filesToLoop, options, options.commitsToCompare);
        const changedFiles = filesWithChangeInfo.filter(item => item.matchCount > 0);
        const totalMatchCount = changedFiles.map(x => x.matchCount).reduce((total, current) => total + current, 0);
        let currentMatchCount = 0;

        for (let i = 0; i < changedFiles.length; i++) {
            const {file, matchCount} = changedFiles[i];
    
            const fileProgress = {
                current: i + 1,
                total: changedFiles.length
            }

            const totalProgress = {
                current: currentMatchCount,
                total: totalMatchCount
            }
            
            await translateVueFileHelper(file, options, fileProgress, totalProgress, options.commitsToCompare);
            currentMatchCount = currentMatchCount + matchCount;
        }

        return;
    }

    for(const file of filesToLoop) {
        await translateVueFileHelper(file, options, undefined, undefined, options.commitsToCompare);
    }
}

type TranslateVueFileHelperOptions = Omit<TranslateVueFileOptions, 'replaceChangesOnly'> & {dryRun?: boolean, replaceChangesOnly?: boolean, doFix?: boolean}

export async function translateVueFileHelper(filePath: string, options: TranslateVueFileHelperOptions, fileProgress?: {
    current: number,
    total: number
}, totalProgress?: {
    current: number,
    total: number
}, commitsToCompare?: [string, string]) {
    let isDoubt = false;

    const fileOptions: TranslateVueFileOptions = {
        attributeWhiteList: options.attributeWhiteList ?? attributeWhiteList,
        doPrompt: options.doPrompt === undefined ? true : options.doPrompt,
        onBeforePrompt: () => {
            // console.clear();
            console.log(chalk.blue(filePath));
        },
        onPromptDoubt: () => {
            isDoubt = true;
            fileCache.doubtFile(filePath);
        },
        replaceChangesOnly: options.replaceChangesOnly ? {filePath, commitsToCompare} : undefined,
        fileProgress,
        totalProgress
    };

    const fileContent = fs.readFileSync(filePath, "utf8");
    const templateContent = getVueTemplate(fileContent);

    if(templateContent === null) {
        return;
    }

    const templateTranslation = await translateVueTemplate(templateContent, fileOptions);
    let newFileContent = replaceTemplate(fileContent, templateTranslation);

    const scriptContent = getScriptContent(fileContent);
    let scriptTranslation = scriptContent;

    if(scriptContent !== null) {
        scriptTranslation = await translateTypescript(scriptContent, fileOptions);
        newFileContent = replaceScript(newFileContent, scriptTranslation, scriptContent);
    }

    if(!isDoubt) {
        fileCache.addFile(filePath);
    }

    if(templateTranslation !== templateContent || scriptContent !== scriptTranslation) {
        const infoText = options.dryRun ? 'Completed with changes (dry-run)' : 'Write file';

        console.log(chalk.magenta(`
${infoText}: `) + chalk.gray(filePath) + `
`)

        if(!options.dryRun) {
            fs.writeFileSync(filePath, newFileContent);

            if(options.doFix) {
                await eslintFormatter.tryFixFile(filePath);
            }
        }
    }
}

async function getMatchInfo(files: string[], options: TranslateVueFileHelperOptions, commitsToCompare?: [string, string]): Promise<{file: string, matchCount: number}[]> {
    const promises = files.map(async file => {
        const matchCount = await getVueFileMatchCount(file, options, commitsToCompare);

        return {
            file,
            matchCount
        }
    });

    return await Promise.all(promises);
}

async function getVueFileMatchCount(filePath: string, options: TranslateVueFileHelperOptions, commitsToCompare?: [string, string]): Promise<number> {
    const fileOptions: TranslateVueFileOptions = {
        attributeWhiteList: options.attributeWhiteList ?? attributeWhiteList,
        doPrompt: false,
        replaceChangesOnly: options.replaceChangesOnly ? {filePath, commitsToCompare} : undefined
    };

    const fileContent = fs.readFileSync(filePath, "utf8");
    const templateContent = getVueTemplate(fileContent);
    const typescriptContent = getScriptContent(fileContent);

    if(templateContent === null) {
        return 0;
    }

    if(typescriptContent !== null) {
        return await getVueTemplateMatchCount(templateContent, fileOptions) + await getScriptMatchCount(typescriptContent, fileOptions);
    }

    return await getVueTemplateMatchCount(templateContent, fileOptions);
}

function getVueTemplate(vueFileContent: string): string | null {
    const templateRegex = /<template>((?:.|\n)+)<\/template>/;

    const match = vueFileContent.match(templateRegex);

    if(match === null) {
        return null;
    }

    return match[0] ?? null;
}

function getScriptContent(vueFileContent: string): string | null {
    const regex = /<script.*>((?:.|\n)+)<\/script>/;

    const match = vueFileContent.match(regex);

    if(match === null) {
        return null;
    }

    return match[1] ?? null;
}

async function getScriptMatchCount(scriptContent: string, options: TypescriptTranslatorOptions): Promise<number> {
    return await getTotalMatchCount(scriptContent, options);
}

function replaceTemplate(vueFileContent: string, templateContent: string) {
    const templateRegex = /<template>((?:.|\n)+)<\/template>/;
    return vueFileContent.replace(templateRegex, templateContent);
}

function replaceScript(vueFileContent: string, scriptTranslation: string, scriptContent: string) {
    return vueFileContent.replace(scriptContent, scriptTranslation);
}
