import { Command } from '@oclif/core';
import { replaceTextArgs, replaceTextFlags } from '../../runtime/translation-flags.js';
import { translateText } from '../../runtime/translation-tools.js';

export default class TranslateReplaceText extends Command {
    static summary = 'Find untranslated text and replace it with translation calls';
    static flags = replaceTextFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(TranslateReplaceText);
        await translateText(replaceTextArgs(flags));
    }
}
