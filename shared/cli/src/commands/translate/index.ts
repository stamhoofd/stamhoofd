import { Command } from '@oclif/core';
import { showHelp } from '../../runtime/show-help.js';

export default class Translate extends Command {
    static summary = 'Prepare, migrate, and maintain translations';
    static description = 'During development, commit Dutch $t(...) strings unchanged. Before a release, use auto to generate keys, clean up, and machine-translate. Use manual for individual steps and maintenance for specialist repair tools. Running this command without a subcommand only shows help.';
    static examples = [
        'stam translate auto',
        'stam translate auto --no-machine',
        'stam translate manual',
    ];

    async run(): Promise<void> {
        await showHelp(this.config, ['translate']);
    }
}
