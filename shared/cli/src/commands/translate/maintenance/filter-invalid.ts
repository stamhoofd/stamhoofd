import { Command, Flags } from '@oclif/core';
import { filterInvalidAutoTranslations } from 'i18n-uuid/post-validator';

export default class TranslateFilterInvalid extends Command {
    static summary = 'Remove machine translations identical to their original';
    static description = 'This can remove legitimate unchanged words such as names. Preview with --dry-run first, or use manual review to decide entry by entry. No AI requests are made.';
    static flags = { 'dry-run': Flags.boolean({ description: 'List invalid entries without removing them' }) };

    async run(): Promise<void> {
        const { flags } = await this.parse(TranslateFilterInvalid);
        filterInvalidAutoTranslations({ dryRun: flags['dry-run'] });
    }
}
