import { Command } from '@oclif/core';
import { replaceKeysOnce } from '../../runtime/translation-tools.js';

export default class TranslateReplaceKeys extends Command {
    static summary = 'Replace translation keys once';

    async run(): Promise<void> {
        await this.parse(TranslateReplaceKeys);
        await replaceKeysOnce();
    }
}
