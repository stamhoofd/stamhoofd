import { Command } from '@oclif/core';
import { translateKeys } from '../../../runtime/translate.js';

export default class TranslateKeys extends Command {
    static summary = 'Replace translation keys with generated keys';
    static examples = ['stam translate manual keys'];

    async run(): Promise<void> {
        await this.parse(TranslateKeys);
        await translateKeys();
    }
}
