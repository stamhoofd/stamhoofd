import { Command } from '@oclif/core';
import { translateMachine } from '../../runtime/translate.js';

export default class TranslateMachine extends Command {
    static summary = 'Machine-translate missing translations';
    static examples = ['stam translate machine'];

    async run(): Promise<void> {
        await this.parse(TranslateMachine);
        await translateMachine();
    }
}
