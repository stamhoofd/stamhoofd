import { Command } from '@oclif/core';
import { showHelp } from '../../runtime/show-help.js';

export default class Test extends Command {
    static summary = 'Run unit and browser tests';
    static description = 'Use these commands to run the fast unit suite, the Playwright browser suite, or both together.';
    static examples = [
        'stam test all --ci',
        'stam test unit',
        'stam test e2e --ui --verbose',
    ];

    async run(): Promise<void> {
        await showHelp(this.config, ['test']);
    }
}
