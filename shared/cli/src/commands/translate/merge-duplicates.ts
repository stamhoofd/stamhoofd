import { Command } from '@oclif/core';
import { inTranslationDirectory } from '../../runtime/translate.js';

export default class TranslateMergeDuplicates extends Command {
    static summary = 'Merge duplicate translation keys';

    async run(): Promise<void> {
        await this.parse(TranslateMergeDuplicates);
        await inTranslationDirectory(async () => {
            const { mergeDuplicates } = await import('i18n-uuid/merge-duplicates');
            mergeDuplicates();
        });
    }
}
