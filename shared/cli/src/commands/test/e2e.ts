import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { ciFlag } from '../../command-flags.js';
import { testE2e } from '../../runtime/monorepo-runner.js';

export default class TestE2e extends BaseCommand {
    static summary = 'Run Playwright browser tests';
    static description = 'Use this when you changed user-facing flows and want to validate the app in a real browser environment.';
    static examples = [
        'stam test e2e',
        'stam test e2e --clear',
        'stam test e2e --ci',
        'stam test e2e --workers 2',
        'stam test e2e --ui --verbose',
    ];

    static flags = {
        ...BaseCommand.verboseFlags,
        ci: ciFlag,
        clear: Flags.boolean({ default: false, description: 'Clear the persistent e2e database before running tests' }),
        ui: Flags.boolean({ default: false, description: 'Run Playwright in UI mode' }),
        workers: Flags.integer({ description: 'Number of Playwright workers' }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(TestE2e);
        if (flags.workers !== undefined && flags.workers < 1) {
            throw new Error('--workers must be at least 1');
        }
        await testE2e(await this.createContext(flags), { ci: flags.ci, clear: flags.clear, ui: flags.ui, workers: flags.workers });
    }
}
