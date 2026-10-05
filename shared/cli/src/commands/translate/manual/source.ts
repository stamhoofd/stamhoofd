import { Command, Flags } from '@oclif/core';
import { inTranslationDirectory } from '../../../runtime/translate.js';

export default class TranslateSource extends Command {
    static summary = 'Wrap untranslated source text in $t(...)';
    static description = 'Optional source migration, not a stage of auto. This rewrites Vue and TypeScript text as translation calls without generating keys or making AI requests. Review and commit the Dutch strings with your source changes.';
    static examples = ['stam translate manual source --changes --dry-run', 'stam translate manual source --changes --prompt --fix'];
    static flags = {
        'changes': Flags.boolean({ char: 'c', description: 'Only process changed files and lines' }),
        'commits': Flags.string({ description: 'Git refs to compare; repeat exactly twice (implies --changes)', multiple: true }),
        'attribute-white-list': Flags.string({ description: 'HTML attribute to process; repeat for multiple attributes', multiple: true }),
        'dry-run': Flags.boolean({ description: 'Preview without writing source files or the processing cache' }),
        'prompt': Flags.boolean({ char: 'p', description: 'Ask before each replacement (not used during dry-run)' }),
        'fix': Flags.boolean({ char: 'f', description: 'Run ESLint on changed files after applying replacements' }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(TranslateSource);
        if (flags.commits && flags.commits.length !== 2) {
            this.error('Repeat --commits exactly twice to select the two Git refs to compare.');
        }
        if (flags.prompt && !flags['dry-run'] && !(process.stdin.isTTY && process.stdout.isTTY)) {
            this.error('--prompt requires an interactive terminal. Use --dry-run to preview without prompts.');
        }
        await inTranslationDirectory(async () => {
            const { replaceText } = await import('i18n-uuid/replace-text');
            await replaceText({
                changes: flags.changes || Boolean(flags.commits),
                commits: flags.commits,
                attributes: flags['attribute-white-list'],
                dryRun: flags['dry-run'],
                prompt: flags.prompt && !flags['dry-run'],
                fix: flags.fix,
            });
        });
    }
}
