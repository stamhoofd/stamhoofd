import { Command } from '@oclif/core';
import { inTranslationDirectory } from '../../../runtime/translate.js';
import { success } from '../../../runtime/ux.js';

export default class TranslateClearCache extends Command {
    static summary = 'Clear the source-migration processing cache';
    static description = 'Clear processed and deferred file lists so manual source can scan those files again. This does not change translations or make AI requests.';

    async run(): Promise<void> {
        await this.parse(TranslateClearCache);
        await inTranslationDirectory(async () => {
            const { fileCache } = await import('i18n-uuid/file-cache');
            fileCache.clear();
        });
        success('Source-migration cache cleared.');
    }
}
