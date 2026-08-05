import { Command } from '@oclif/core';
import { showHelp } from '../../runtime/show-help.js';

export default class Metabase extends Command {
    static summary = 'Manage the local Metabase server';
    static description = 'Use these commands to run Metabase locally against the development database, inspect its logs, and stop it again.';
    static examples = [
        'stam metabase start',
        'stam metabase config',
        'stam metabase logs',
        'stam metabase stop',
    ];

    async run(): Promise<void> {
        await showHelp(this.config, ['metabase']);
    }
}
