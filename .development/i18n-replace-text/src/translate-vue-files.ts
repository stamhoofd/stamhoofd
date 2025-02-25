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

    if(options.replaceChangesOnly) {
        const changedFiles = getChangedFiles('vue');
        
        for (const filePath of files.filter(filePath => changedFiles.has(filePath))) {
            await translateVueFileHelper(filePath, options);
        }

        return;
    }

    for (const filePath of files) {
        await translateVueFileHelper(filePath, options);
    }
}

type TranslateVueFileHelperOptions = Omit<TranslateVueFileOptions, 'replaceChangesOnly'> & {dryRun?: boolean, replaceChangesOnly?: boolean}

export async function translateVueFileHelper(filePath: string, options: TranslateVueFileHelperOptions) {
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
        replaceChangesOnly: options.replaceChangesOnly ? {filePath} : undefined
    };

    const fileContent = fs.readFileSync(filePath, "utf8");
    const templateContent = getVueTemplate(fileContent);

    if(templateContent === null) {
        return;
    }

    const translation = await translateVueTemplate(templateContent, fileOptions);

    if(!options.dryRun) {
        const newFileContent = replaceTemplate(fileContent, translation);
        fs.writeFileSync(filePath, newFileContent);
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
