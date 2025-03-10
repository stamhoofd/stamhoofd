/**
 * TODO:
 * - calcualte tokens
 * - calculate estimated price?
 * - improve prompt
 * - provide context?
 * - context caching?
 * - add feedback while translating (if it takes a long time for example)
 */

import { globals } from "../shared/globals";
import { AutoTranslateOptions } from "../types/AutoTranslateOptions";
import { AutoTranslator } from "./AutoTranslator";
import { TranslationManager } from "./TranslationManager";

export async function autoTranslate(args: Partial<AutoTranslateOptions>) {
    const manager = new TranslationManager();
    const autoTranslator = new AutoTranslator(globals.TRANSLATOR, manager, {
        fake: args.fake ?? false,
        translatorType: args.translatorType ?? globals.TRANSLATOR,
        locales: args.locales,
    });
    await autoTranslator.start();
}
