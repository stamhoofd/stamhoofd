import { Command } from '@oclif/core';
import { compressUuids } from '../../runtime/translation-tools.js';

export default class TranslateCompressUuids extends Command {
    static summary = 'Compress translation UUIDs into short keys';

    async run(): Promise<void> {
        await this.parse(TranslateCompressUuids);
        await compressUuids();
    }
}
