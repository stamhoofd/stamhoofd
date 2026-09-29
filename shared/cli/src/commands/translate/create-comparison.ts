import { Command } from '@oclif/core';
import { createTranslationComparison } from '../../runtime/translation-tools.js';

export default class TranslateCreateComparison extends Command {
    static summary = 'Create a comparison of machine translations by locale';

    async run(): Promise<void> {
        await this.parse(TranslateCreateComparison);
        await createTranslationComparison();
    }
}
