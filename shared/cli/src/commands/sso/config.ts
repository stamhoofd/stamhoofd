import { Args } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { buildDomains } from '../../config/build-config.js';
import { buildSsoConfigOutput } from '../../services/sso-config.js';

export default class SsoConfig extends BaseCommand {
    static summary = 'Print local SSO settings';
    static description = 'Use this while configuring SSO in Stamhoofd or checking which issuer, credentials, and redirect URI the local SSO server expects.';
    static examples = [
        'stam sso config',
        'stam sso config "https://keeo.api.stamhoofd/openid/callback"',
    ];
    static args = { redirectUri: Args.string({ required: false }) };
    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { args, flags } = await this.parse(SsoConfig);
        const context = await this.createContext(flags);
        const domains = buildDomains(context);
        this.log(buildSsoConfigOutput(domains, args.redirectUri));
    }
}
