import { Command } from '@oclif/core';
import { translateCompress } from '../../../runtime/translate.js';

export default class TranslateCleanup extends Command {
    static summary = 'Merge duplicate translations and remove unused keys';
    static examples = ['stam translate manual cleanup'];

    async run(): Promise<void> {
        await this.parse(TranslateCleanup);
        await translateCompress();
    }
}
