import { translateHtml } from "./translate-html";

export interface TranslateVueFileOptions {
    doPrompt?: boolean,
    attributeWhiteList?: Set<string>
}

export async function translateVueTemplate(vueTemplate: string, options: TranslateVueFileOptions = {}) {
    return translateHtml(vueTemplate, {skipKeys: new Set(['script', 'style']), ...options});
}
