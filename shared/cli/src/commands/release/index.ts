import { Command } from '@oclif/core';
import { showHelp } from '../../runtime/show-help.js';

export default class Release extends Command {
    static summary = 'Generate and publish release notes';
    static description = 'Summarize emoji-prefixed commits into release notes, preview the pending release, or publish notes for the current version tag to GitHub.';
    static examples = [
        'stam release notes',
        'stam release publish',
    ];

    async run(): Promise<void> {
        await showHelp(this.config, ['release']);
    }
}
