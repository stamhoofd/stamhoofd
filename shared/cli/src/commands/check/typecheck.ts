import { BaseCommand } from '../../base-command.js';
import { typecheck } from '../../runtime/monorepo-runner.js';

export default class CheckTypecheck extends BaseCommand {
    static summary = 'Run TypeScript checks';
    static description = 'Use this when you changed shared types or want to verify cross-package type safety before running heavier checks.';
    static examples = [
        'stam check typecheck',
        'stam check typecheck --verbose',
    ];
    static flags = BaseCommand.verboseFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(CheckTypecheck);
        await typecheck(await this.createContext(flags));
    }
}
