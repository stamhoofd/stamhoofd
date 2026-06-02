import { BaseCommand } from '../../base-command.js';
import { lint } from '../../runtime/monorepo-runner.js';

export default class CheckLint extends BaseCommand {
    static summary = 'Run ESLint';
    static description = 'Use this when you want fast feedback on style and lint rules without running the full validation suite.';
    static examples = [
        'stam check lint',
        'stam check lint --verbose',
    ];
    static flags = BaseCommand.verboseFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(CheckLint);
        await lint(await this.createContext(flags));
    }
}
