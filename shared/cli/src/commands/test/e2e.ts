import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { ciFlag } from '../../command-flags.js';
import { testE2e } from '../../runtime/monorepo-runner.js';

export default class TestE2e extends BaseCommand {
    static summary = 'Run Playwright browser tests';
    static description = 'Use this when you changed user-facing flows and want to validate the app in a real browser environment.';
    static examples = [
        'stam test e2e',
        'stam test e2e --ci',
        'stam test e2e --ui --verbose',
    ];

    static flags = { ...BaseCommand.verboseFlags, ci: ciFlag, ui: Flags.boolean({ default: false, description: 'Run Playwright in UI mode' }) };

    async run(): Promise<void> {
        const { flags } = await this.parse(TestE2e);
        await testE2e(await this.createContext(flags), { ci: flags.ci, ui: flags.ui });
    }
}
