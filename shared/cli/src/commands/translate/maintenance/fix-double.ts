import { Command } from '@oclif/core';
import { inTranslationDirectory } from '../../../runtime/translate.js';

export default class TranslateFixDouble extends Command {
    static summary = 'Remove redundant machine translations from other namespaces';
    static description = 'Remove machine entries duplicated by the default namespace. This modifies machine translation files without making AI requests.';

    async run(): Promise<void> {
        await this.parse(TranslateFixDouble);
        await inTranslationDirectory(async () => {
            const { fixDoubleTranslations } = await import('i18n-uuid/fix-double-translations');
            fixDoubleTranslations();
        });
    }
}
