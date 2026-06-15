import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { buildDomains } from '../../config/build-config.js';
import { CaddyService } from '../../services/definitions/caddy-service.js';
import { ssoService } from '../../services/definitions/sso-service.js';
import { allRunning, startServices } from '../../services/manager.js';
import { sharedServiceDefinitions } from '../../services/registry.js';
import { buildSsoConfigOutput } from '../../services/sso-config.js';

export default class SsoStart extends BaseCommand {
    static summary = 'Start the local SSO server';
    static description = 'Use this after enabling SSO for an organization so you can test the login flow locally. The selected environment or instance still determines the local SSO hostname, container name, and port.';
    static examples = [
        'stam sso start "https://<organization-id>.api.stamhoofd/openid/callback"',
        'stam sso start --background "https://<organization-id>.api.stamhoofd/openid/callback"',
    ];

    static args = { redirectUri: Args.string({ required: true, description: 'Redirect URI copied from Stamhoofd SSO settings' }) };
    static flags = { ...BaseCommand.instanceFlags, background: Flags.boolean({ char: 'b', default: false }) };

    async run(): Promise<void> {
        const { args, flags } = await this.parse(SsoStart);
        if (!args.redirectUri.startsWith('https://') || !args.redirectUri.endsWith('/openid/callback')) {
            this.error('Expected an HTTPS /openid/callback URL copied from the SSO settings view.');
        }
        const context = await this.createContext(flags);
        this.log(buildSsoConfigOutput(buildDomains(context), args.redirectUri));
        if (!(await allRunning(context, sharedServiceDefinitions))) {
            await startServices(context, sharedServiceDefinitions);
        }
        await CaddyService.reload(context);
        await ssoService.start(context, { redirectUri: args.redirectUri, background: flags.background });
    }
}
