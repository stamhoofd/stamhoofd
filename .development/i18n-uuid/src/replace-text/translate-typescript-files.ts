import chalk from "chalk";
import fs from "fs";
import { getFilesToSearch } from "../shared/get-files-to-search";
import { eslintFormatter } from "./eslint-formatter";
import { getChangedFiles } from "./git-helper";
import { getTotalMatchCount, translateTypescript, TypescriptTranslatorOptions } from "./typeScript-translator";

interface TranslateTypescriptFilesOptions {
    replaceChangesOnly?: boolean;
    doPrompt?: boolean;
    doFix?: boolean;
    dryRun?: boolean;

    commitsToCompare?: [string, string];
    attributeWhiteList?: Set<string>;
}

export async function translateTypescriptFiles(options: TranslateTypescriptFilesOptions = {}) {
    const files = getFilesToSearch(['typescript']);
    let filesToLoop: string[];

    if(options.replaceChangesOnly) {
        const changedFiles = getChangedFiles('ts', {compare: options.commitsToCompare});
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
            
            await translateTypescriptFileHelper(file, options, fileProgress, totalProgress, options.commitsToCompare);
            currentMatchCount = currentMatchCount + matchCount;
        }

        return;
    }

    for(const file of filesToLoop) {
        await translateTypescriptFileHelper(file, options, undefined, undefined, options.commitsToCompare);
    }
}

export interface TranslateTypescriptFileOptions {
    doPrompt?: boolean,
    onBeforePrompt?: () => void,
    replaceChangesOnly?: {
        filePath: string,
        commitsToCompare?: [string, string]
    },
    totalProgress?: {
        current: number,
        total: number
    }
    fileProgress?: {
        current: number,
        total: number
    }
}

type TranslateTypescriptFileHelperOptions = Omit<TranslateTypescriptFileOptions, 'replaceChangesOnly'> & {dryRun?: boolean, replaceChangesOnly?: boolean, doFix?: boolean}

export async function translateTypescriptFileHelper(filePath: string, options: TranslateTypescriptFileHelperOptions, fileProgress?: {
    current: number,
    total: number
}, totalProgress?: {
    current: number,
    total: number
}, commitsToCompare?: [string, string]) {
    const fileOptions: TranslateTypescriptFileOptions = {
        doPrompt: options.doPrompt === undefined ? true : options.doPrompt,
        onBeforePrompt: () => {
            // console.clear();
            console.log(chalk.blue(filePath));
        },
        replaceChangesOnly: options.replaceChangesOnly ? {filePath, commitsToCompare} : undefined,
        fileProgress,
        totalProgress
    };

    const fileContent = fs.readFileSync(filePath, "utf8");
    const translation = await translateTypescript(fileContent, fileOptions);

    if(translation !== fileContent) {
        const infoText = options.dryRun ? 'Completed with changes (dry-run)' : 'Write file';

        console.log(chalk.magenta(`
${infoText}: `) + chalk.gray(filePath) + `
`)

        if(!options.dryRun) {
            fs.writeFileSync(filePath, translation);

            if(options.doFix) {
                await eslintFormatter.tryFixFile(filePath);
            }
        }
    }
}

async function getMatchInfo(files: string[], options: TranslateTypescriptFilesOptions, commitsToCompare?: [string, string]): Promise<{file: string, matchCount: number}[]> {
    const promises = files.map(async file => {
        const matchCount = await getTypescriptFileMatchCount(file, options, commitsToCompare);

        return {
            file,
            matchCount
        }
    });

    return await Promise.all(promises);
}

async function getTypescriptFileMatchCount(filePath: string, options: TranslateTypescriptFilesOptions, commitsToCompare?: [string, string]): Promise<number> {
    const fileOptions: TypescriptTranslatorOptions = {
        doPrompt: false,
        replaceChangesOnly: options.replaceChangesOnly ? {filePath, commitsToCompare} : undefined
    };

    const fileContent = fs.readFileSync(filePath, "utf8");

    return await getTotalMatchCount(fileContent, fileOptions);
}
