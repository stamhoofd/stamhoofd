import { Command } from '@oclif/core';
import { translateMachine } from '../../../runtime/translate.js';
import { machineArgs, machineFlags } from '../../../runtime/translation-flags.js';

export default class TranslateMachine extends Command {
    static summary = 'Machine-translate missing translations';
    static description = 'Build locales and translate missing or changed strings. This modifies machine translation files and can make paid AI requests.';
    static examples = ['stam translate manual machine --locale fr'];
    static flags = machineFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(TranslateMachine);
        await translateMachine(machineArgs(flags));
    }
}
