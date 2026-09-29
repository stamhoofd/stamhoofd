import { Command } from '@oclif/core';
import { translateMachine } from '../../runtime/translate.js';
import { machineArgs, machineFlags } from '../../runtime/translation-flags.js';

export default class TranslateMachine extends Command {
    static summary = 'Machine-translate missing translations';
    static examples = ['stam translate machine'];
    static flags = machineFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(TranslateMachine);
        await translateMachine(machineArgs(flags));
    }
}
