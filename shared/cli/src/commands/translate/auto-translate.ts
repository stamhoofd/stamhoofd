import { Command } from '@oclif/core';
import { machineArgs, machineFlags } from '../../runtime/translation-flags.js';
import { translateAutomatically } from '../../runtime/translation-tools.js';

export default class TranslateAutoTranslate extends Command {
    static summary = 'Translate missing or changed translations with an AI model';
    static flags = machineFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(TranslateAutoTranslate);
        await translateAutomatically(machineArgs(flags));
    }
}
