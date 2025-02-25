import chalk from "chalk";
import fs from "fs";
import { getFilesToSearch } from "./get-files-to-search";
import { getChangedFiles } from "./git-helper";
import { TranslateVueFileOptions, translateVueTemplate } from "./translate-vue-template";

interface TranslateVueFilesOptions {
    replaceChangesOnly?: boolean;
    doPrompt?: boolean;
    dryRun?: boolean;
    attributeWhiteList?: Set<string>
}

export async function translateVueFiles(options: TranslateVueFilesOptions = {}) {
    const files = getFilesToSearch(['vue']);
    let filesToLoop: string[];

    if(options.replaceChangesOnly) {
        const changedFiles = getChangedFiles('vue');
        filesToLoop = files.filter(filePath => changedFiles.has(filePath));
    } else {
        filesToLoop = files;
    }
    
    const totalFiles = filesToLoop.length;

    for (let i = 0; i < filesToLoop.length; i++) {
        const filePath = filesToLoop[i];
        const fileProgress = {
            current: i + 1,
            total: totalFiles
        }
        
        await translateVueFileHelper(filePath, options, fileProgress);
    }
}

type TranslateVueFileHelperOptions = Omit<TranslateVueFileOptions, 'replaceChangesOnly'> & {dryRun?: boolean, replaceChangesOnly?: boolean}

export async function translateVueFileHelper(filePath: string, options: TranslateVueFileHelperOptions, fileProgress?: {
    current: number,
    total: number
}) {
    const fileOptions: TranslateVueFileOptions = {
        attributeWhiteList: options.attributeWhiteList ?? new Set([
            'placeholder',
            'label',
            'title',
            'text'
        ]),
        doPrompt: options.doPrompt === undefined ? true : options.doPrompt,
        onBeforePrompt: () => {
            // console.clear();
            console.log(chalk.blue(filePath));
        },
        replaceChangesOnly: options.replaceChangesOnly ? {filePath} : undefined,
        fileProgress
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
