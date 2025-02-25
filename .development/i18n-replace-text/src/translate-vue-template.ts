import { translateHtml } from "./html-translator";

export interface TranslateVueFileOptions {
    doPrompt?: boolean,
    attributeWhiteList?: Set<string>
    onBeforePrompt?: () => void,
    replaceChangesOnly?: {
        filePath: string
    },
    fileProgress?: {
        current: number,
        total: number
    }
}

export async function translateVueTemplate(vueTemplate: string, options: TranslateVueFileOptions = {}) {
    return translateHtml(vueTemplate, {skipKeys: new Set(['script', 'style']), ...options});
}
