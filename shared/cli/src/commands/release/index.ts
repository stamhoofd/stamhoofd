import { Command } from '@oclif/core';
import { showHelp } from '../../runtime/show-help.js';

export default class Release extends Command {
    static summary = 'Version and publish packages and release notes';
    static description = 'Bump the fixed version of publishable packages, publish them to npm, and manage GitHub release notes.';
    static examples = [
        'stam release notes',
        'stam release version',
        'stam release packages',
        'stam release publish',
    ];

    async run(): Promise<void> {
        await showHelp(this.config, ['release']);
    }
}
