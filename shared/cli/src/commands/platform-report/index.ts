import { Command } from '@oclif/core';
import { showHelp } from '../../runtime/show-help.js';

export default class PlatformReport extends Command {
    static summary = 'Run the platform report locally';
    static description = 'Use these commands to read the ledenstatistieken of an environment on your own machine. Start brings up everything the report needs, the others inspect, rewrite or stop what it left running.';
    static examples = [
        'stam platform-report start',
        'stam platform-report dashboards',
        'stam platform-report config',
        'stam platform-report logs',
        'stam platform-report stop',
    ];

    async run(): Promise<void> {
        await showHelp(this.config, ['platform-report']);
    }
}
