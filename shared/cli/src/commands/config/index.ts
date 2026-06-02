import { Command } from '@oclif/core';
import { showHelp } from '../../runtime/show-help.js';

export default class Config extends Command {
    static summary = 'Inspect resolved local configuration';
    static description = 'Use these commands to confirm which environment, instance, domains, and settings `stam` resolved before you start running things locally.';
    static examples = [
        'stam config print --env keeo',
        'stam config explain --env keeo --name feature-payments',
        'stam config print --env keeo --verbose',
    ];

    async run(): Promise<void> {
        await showHelp(this.config, ['config']);
    }
}
