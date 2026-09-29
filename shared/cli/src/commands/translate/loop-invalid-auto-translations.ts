import { Command, Flags } from '@oclif/core';
import { loopInvalidAutoTranslations } from '../../runtime/translation-tools.js';

export default class TranslateLoopInvalid extends Command {
    static summary = 'Review invalid machine translations interactively';
    static flags = { 'dry-run': Flags.boolean({ description: 'Do not remove invalid translations' }) };

    async run(): Promise<void> {
        const { flags } = await this.parse(TranslateLoopInvalid);
        await loopInvalidAutoTranslations(flags['dry-run']);
    }
}
