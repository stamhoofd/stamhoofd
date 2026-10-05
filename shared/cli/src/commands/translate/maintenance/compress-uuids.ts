import { Command } from '@oclif/core';
import { compressUuids } from 'i18n-uuid/compress-uuids';

export default class TranslateCompressUuids extends Command {
    static summary = 'Convert translation UUIDs to compact keys';
    static description = 'Rewrite keys in source and translation files. Key registration already includes this operation; normally use auto or manual keys instead.';

    async run(): Promise<void> {
        await this.parse(TranslateCompressUuids);
        compressUuids();
    }
}
