import chalk from "chalk";
import fs from "fs";
import { getFilesToSearch } from "./get-files-to-search";
import { getChangedFiles } from "./git-helper";
import { getVueTemplateMatchCount, TranslateVueFileOptions, translateVueTemplate } from "./translate-vue-template";

interface TranslateVueFilesOptions {
    replaceChangesOnly?: boolean;
    doPrompt?: boolean;
    dryRun?: boolean;
    attributeWhiteList?: Set<string>
}

const attributeWhiteList = new Set([
    'placeholder',
    'label',
    'title',
    'text'
]);

export async function translateVueFiles(options: TranslateVueFilesOptions = {}) {
    const files = getFilesToSearch(['vue']);
    let filesToLoop: string[];

    if(options.replaceChangesOnly) {
        const changedFiles = getChangedFiles('vue');
        filesToLoop = files.filter(filePath => changedFiles.has(filePath));
    } else {
        filesToLoop = files;
    }

    if(options.doPrompt) {
        const filesWithChangeInfo = await getChangeInfo(filesToLoop, options);
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
            
            await translateVueFileHelper(file, options, fileProgress, totalProgress);
            currentMatchCount = currentMatchCount + matchCount;
        }

        return;
    }

    for(const file of filesToLoop) {
        await translateVueFileHelper(file, options);
    }
}

type TranslateVueFileHelperOptions = Omit<TranslateVueFileOptions, 'replaceChangesOnly'> & {dryRun?: boolean, replaceChangesOnly?: boolean}

export async function translateVueFileHelper(filePath: string, options: TranslateVueFileHelperOptions, fileProgress?: {
    current: number,
    total: number
}, totalProgress?: {
    current: number,
    total: number
}) {
    const fileOptions: TranslateVueFileOptions = {
        attributeWhiteList: options.attributeWhiteList ?? attributeWhiteList,
        doPrompt: options.doPrompt === undefined ? true : options.doPrompt,
        onBeforePrompt: () => {
            // console.clear();
            console.log(chalk.blue(filePath));
        },
        replaceChangesOnly: options.replaceChangesOnly ? {filePath} : undefined,
        fileProgress,
        totalProgress
    };

    const fileContent = fs.readFileSync(filePath, "utf8");
    const templateContent = getVueTemplate(fileContent);

    if(templateContent === null) {
        return;
    }

    const translation = await translateVueTemplate(templateContent, fileOptions);

    if(translation !== templateContent) {
        const infoText = options.dryRun ? 'Completed with changes (dry-run)' : 'Write file';

        console.log(chalk.magenta(`
${infoText}: `) + chalk.gray(filePath) + `
`)

        if(!options.dryRun) {
            const newFileContent = replaceTemplate(fileContent, translation);
            
            fs.writeFileSync(filePath, newFileContent);
        }
    }
}

async function getChangeInfo(files: string[], options: TranslateVueFileHelperOptions): Promise<{file: string, matchCount: number}[]> {
    const promises = files.map(async file => {
        const matchCount = await getVueFileMatchCount(file, options);

        return {
            file,
            matchCount
        }
    });

    return await Promise.all(promises);
}

async function getVueFileMatchCount(filePath: string, options: TranslateVueFileHelperOptions): Promise<number> {
    const fileOptions: TranslateVueFileOptions = {
        attributeWhiteList: options.attributeWhiteList ?? attributeWhiteList,
        doPrompt: false,
        replaceChangesOnly: options.replaceChangesOnly ? {filePath} : undefined
    };

    const fileContent = fs.readFileSync(filePath, "utf8");
    const templateContent = getVueTemplate(fileContent);

    if(templateContent === null) {
        return 0;
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

function replaceTemplate(vueFileContent: string, templateContent: string) {
    const templateRegex = /<template>((?:.|\n)+)<\/template>/;
    return vueFileContent.replace(templateRegex, templateContent);
}
