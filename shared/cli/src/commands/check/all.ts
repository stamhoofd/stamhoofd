import { BaseCommand } from '../../base-command.js';
import { buildAll, lint, testE2e, testUnit, typecheck } from '../../runtime/monorepo-runner.js';

export default class CheckAll extends BaseCommand {
    static summary = 'Run all validation checks';
    static description = 'Use this before pushing when you want roughly the same broad safety net as the main automated checks.';
    static examples = [
        'stam check all',
        'stam check all --env keeo',
    ];
    static flags = BaseCommand.environmentFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(CheckAll);
        const context = await this.createContext(flags);
        await buildAll(context);
        await lint(context);
        await typecheck(context);
        await testUnit(context, true);
        await testE2e(context, { ci: true, ui: false });
    }
}
