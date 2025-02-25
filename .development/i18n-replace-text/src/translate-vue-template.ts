import { translateHtml } from "./html-translator";

export interface TranslateVueFileOptions {
    doPrompt?: boolean,
    attributeWhiteList?: Set<string>
    onBeforePrompt?: () => void,
    replaceChangesOnly?: {
        filePath: string
    }
}

export async function translateVueTemplate(vueTemplate: string, options: TranslateVueFileOptions = {}) {
    return translateHtml(vueTemplate, {skipKeys: new Set(['script', 'style']), ...options});
}
