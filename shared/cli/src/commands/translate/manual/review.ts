import { Command, Flags } from '@oclif/core';
import { loopAndPromptValidateInvalidTranslations } from 'i18n-uuid/post-validator';

export default class TranslateReview extends Command {
    static summary = 'Review machine translations identical to the original';
    static description = 'Optional review, not a stage of auto or a general quality check. Accept (y/Enter) writes the translation to the human-maintained locale file and removes its machine entry. Reject (n) removes the machine entry so it can be translated again. Defer (d) leaves it unchanged. No AI requests are made.';
    static examples = ['stam translate manual review --dry-run', 'stam translate manual review'];
    static flags = { 'dry-run': Flags.boolean({ description: 'Show unchanged translations without prompting or modifying translation files' }) };

    async run(): Promise<void> {
        const { flags } = await this.parse(TranslateReview);
        if (!flags['dry-run'] && !(process.stdin.isTTY && process.stdout.isTTY)) {
            this.error('Review requires an interactive terminal. Use --dry-run to list entries without changing them.');
        }
        await loopAndPromptValidateInvalidTranslations({ dryRun: flags['dry-run'] });
    }
}
