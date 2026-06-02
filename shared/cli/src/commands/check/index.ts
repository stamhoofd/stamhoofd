import { Command } from '@oclif/core';
import { showHelp } from '../../runtime/show-help.js';

export default class Check extends Command {
    static summary = 'Run build, lint, typecheck, and tests';
    static description = 'Use these commands to run build, lint, type checks, or the full validation suite locally before opening a PR.';
    static examples = [
        'stam check lint',
        'stam check typecheck',
        'stam check all',
    ];

    async run(): Promise<void> {
        await showHelp(this.config, ['check']);
    }
}
