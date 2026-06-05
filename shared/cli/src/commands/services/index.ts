import { Command } from '@oclif/core';
import { showHelp } from '../../runtime/show-help.js';

export default class Services extends Command {
    static summary = 'Manage shared local services';
    static description = 'Use these commands to inspect, start, stop, or troubleshoot shared container services such as MySQL, Caddy, DNS, MailDev, and RustFS.';
    static examples = [
        'stam services status',
        'stam services up',
        'stam services restart --verbose',
    ];

    async run(): Promise<void> {
        await showHelp(this.config, ['services']);
    }
}
