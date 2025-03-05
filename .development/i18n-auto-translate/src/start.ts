/**
 * TODO:
 * - improve prompt
 * - provide context?
 * - context caching?
 * - add feedback while translating (if it takes a long time for example)
 */

import { AutoTranslator } from "./AutoTranslator";
import { TranslationManager } from "./TranslationManager";
import { GoogleTranslator } from "./translators/GoogleTranslator";

export async function start() {
    const manager = new TranslationManager();
    const translator = new GoogleTranslator(manager);
    const autoTranslator = new AutoTranslator(translator, manager);
    await autoTranslator.start();
}
