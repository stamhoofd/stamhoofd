/**
 * TODO:
 * - calcualte tokens
 * - calculate estimated price?
 * - improve prompt
 * - provide context?
 * - context caching?
 */

import { globals } from '../shared/globals.js';
import type { AutoTranslateOptions } from '../types/AutoTranslateOptions.js';
import { AutoTranslator } from './AutoTranslator.js';
import { TranslationManager } from './TranslationManager.js';
import { promptLogger } from './PromptLogger.js';
import path from 'node:path';

export async function autoTranslate(args: Partial<AutoTranslateOptions>) {
    const manager = new TranslationManager();
    const autoTranslator = new AutoTranslator(args.translatorType ?? globals.TRANSLATOR, manager, {
        apiKey: args.apiKey,
        onProgress: args.onProgress,
        fake: args.fake ?? false,
        translatorType: args.translatorType ?? globals.TRANSLATOR,
        locales: args.locales,
    });
    promptLogger.initialize(path.join(globals.I18NUUID_ROOT, '.development/i18n-uuid'));
    try {
        await autoTranslator.start();
    }
    finally {
        await promptLogger.close();
    }
}
