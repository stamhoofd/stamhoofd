import { getTotalMatchCount, translateHtml } from "./html-translator";

export interface TranslateVueFileOptions {
    doPrompt?: boolean,
    attributeWhiteList?: Set<string>
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

export async function translateVueTemplate(vueTemplate: string, options: TranslateVueFileOptions = {}) {
    return translateHtml(vueTemplate, {skipKeys: new Set(['script', 'style']), ...options});
}

export async function getVueTemplateMatchCount(vueTemplate: string, options: TranslateVueFileOptions = {}): Promise<number> {
    return getTotalMatchCount(vueTemplate, {skipKeys: new Set(['script', 'style']), ...options});
}
