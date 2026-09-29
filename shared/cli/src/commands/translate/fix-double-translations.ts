import { Command } from '@oclif/core';
import { fixDoubleTranslations } from '../../runtime/translation-tools.js';

export default class TranslateFixDouble extends Command {
    static summary = 'Fix double translations';

    async run(): Promise<void> {
        await this.parse(TranslateFixDouble);
        await fixDoubleTranslations();
    }
}
