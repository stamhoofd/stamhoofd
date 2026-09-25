import { BaseCommand } from '../../base-command.js';
import { runServices } from '../../workflows/start-services.js';
import { RunVerbosity } from '../../runtime/command-runner.js';

export default class ServicesUp extends BaseCommand {
    static override verbosity = RunVerbosity.Quiet;
    static summary = 'Start shared services';
    static description = 'Use this when you want shared infrastructure running before starting an app instance or when debugging a service container on its own.';
    static examples = [
        'stam services up',
        'stam services up -vv',
    ];
    static flags = this.verbosityFlags();

    async run(): Promise<void> {
        const { context } = await this.parseWithContext(ServicesUp);
        await runServices(context);
    }
}
