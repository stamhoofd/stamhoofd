import { Command, Flags } from '@oclif/core';
import { filterInvalidAutoTranslations } from '../../runtime/translation-tools.js';

export default class TranslateFilterInvalid extends Command {
    static summary = 'Remove invalid machine translations';
    static flags = { 'dry-run': Flags.boolean({ description: 'Do not remove invalid translations' }) };

    async run(): Promise<void> {
        const { flags } = await this.parse(TranslateFilterInvalid);
        await filterInvalidAutoTranslations(flags['dry-run']);
    }
}
