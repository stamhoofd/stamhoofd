import { Command } from '@oclif/core';
import { translateCompress } from '../../runtime/translate.js';

export default class TranslateCompress extends Command {
    static summary = 'Merge duplicate translations and remove unused keys';
    static examples = ['stam translate compress'];

    async run(): Promise<void> {
        await this.parse(TranslateCompress);
        await translateCompress();
    }
}
