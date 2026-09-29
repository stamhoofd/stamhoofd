import { Command } from '@oclif/core';
import { machineArgs, machineFlags, replaceTextArgs, replaceTextFlags } from '../../runtime/translation-flags.js';
import { createTranslationComparison, replaceKeysOnce, translateAutomatically, translateText } from '../../runtime/translation-tools.js';

export default class TranslateStart extends Command {
    static summary = 'Replace untranslated text and keys, then translate and compare';
    static flags = { ...replaceTextFlags, ...machineFlags };

    async run(): Promise<void> {
        const { flags } = await this.parse(TranslateStart);
        await translateText(replaceTextArgs(flags));
        await replaceKeysOnce();
        await translateAutomatically(machineArgs(flags));
        await createTranslationComparison();
    }
}
