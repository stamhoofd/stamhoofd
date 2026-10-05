import { Command } from '@oclif/core';
import { fixDoubleTranslations } from 'i18n-uuid/fix-double-translations';

export default class TranslateFixDouble extends Command {
    static summary = 'Remove redundant machine translations from other namespaces';
    static description = 'Remove machine entries duplicated by the default namespace. This modifies machine translation files without making AI requests.';

    async run(): Promise<void> {
        await this.parse(TranslateFixDouble);
        fixDoubleTranslations();
    }
}
