import { Command } from '@oclif/core';
import { clearTranslationCache } from '../../runtime/translation-tools.js';

export default class TranslateClearCache extends Command {
    static summary = 'Clear the translation file cache';

    async run(): Promise<void> {
        await this.parse(TranslateClearCache);
        await clearTranslationCache();
    }
}
