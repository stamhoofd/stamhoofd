/**
 * TODO:
 * - calcualte tokens
 * - calculate estimated price?
 * - improve prompt
 * - provide context?
 * - context caching?
 * - add feedback while translating (if it takes a long time for example)
 */

import { AutoTranslator } from "./AutoTranslator";
import { globals } from "./globals";
import { TranslationManager } from "./TranslationManager";

export async function start() {
    const manager = new TranslationManager();
    const autoTranslator = new AutoTranslator(globals.TRANSLATOR, manager);
    await autoTranslator.start();
}
