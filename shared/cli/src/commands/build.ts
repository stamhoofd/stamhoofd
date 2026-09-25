import { BaseCommand } from '../base-command.js';
import { RunVerbosity } from '../runtime/command-runner.js';
import { buildAll } from '../runtime/monorepo-runner.js';

export default class Build extends BaseCommand {
    static override verbosity = RunVerbosity.Output;
    static summary = 'Build all Stamhoofd packages';
    static description = 'Use this when generated artifacts are stale or before running broader checks that depend on a clean build.';
    static examples = [
        'stam build --env keeo',
        'stam build --quiet',
    ];

    static flags = { env: BaseCommand.environmentFlags.env, ...this.verbosityFlags() };

    async run(): Promise<void> {
        const { context } = await this.parseWithContext(Build);
        await buildAll(context);
    }
}
