import { Command } from '@oclif/core';
import { inTranslationDirectory } from '../../../runtime/translate.js';

export default class TranslateCompressUuids extends Command {
    static summary = 'Convert translation UUIDs to compact keys';
    static description = 'Rewrite keys in source and translation files. Key registration already includes this operation; normally use auto or manual keys instead.';

    async run(): Promise<void> {
        await this.parse(TranslateCompressUuids);
        await inTranslationDirectory(async () => {
            const { compressUuids } = await import('i18n-uuid/compress-uuids');
            compressUuids();
        });
    }
}
