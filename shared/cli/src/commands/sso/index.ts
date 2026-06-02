import { Command } from '@oclif/core';
import { showHelp } from '../../runtime/show-help.js';

export default class Sso extends Command {
    static summary = 'Manage local SSO testing server';
    static description = 'Use these commands to print local SSO settings, start the local SSO server, inspect logs, and stop it again while testing login flows.';
    static examples = [
        'stam sso config',
        'stam sso start "https://<organization-id>.api.stamhoofd/openid/callback"',
        'stam sso logs',
        'stam sso stop',
    ];

    async run(): Promise<void> {
        await showHelp(this.config, ['sso']);
    }
}
