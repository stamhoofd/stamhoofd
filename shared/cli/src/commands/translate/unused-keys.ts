import { Command } from '@oclif/core';
import { inTranslationDirectory } from '../../runtime/translate.js';

export default class TranslateUnusedKeys extends Command {
    static summary = 'Remove unused translation keys';

    async run(): Promise<void> {
        await this.parse(TranslateUnusedKeys);
        await inTranslationDirectory(async () => {
            const { unusedKeys } = await import('i18n-uuid/unused-keys');
            unusedKeys();
        });
    }
}
