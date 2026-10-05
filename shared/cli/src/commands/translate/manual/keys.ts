import { Command } from '@oclif/core';
import { translateKeys } from '../../../runtime/translate.js';
import { info } from '../../../runtime/ux.js';

export default class TranslateKeys extends Command {
    static summary = 'Replace translation keys with generated keys';
    static examples = ['stam translate manual keys'];

    async run(): Promise<void> {
        await this.parse(TranslateKeys);
        await translateKeys();
        info('Next, run "stam translate manual cleanup" to merge duplicate translations and remove unused keys.');
    }
}
