import { Args } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { buildDomains } from '../../config/build-config.js';
import { ssoAdminPassword, ssoAdminUser, ssoClientId, ssoClientSecret, ssoRealm, ssoUserEmail, ssoUserName, ssoUserPassword } from '../../services/sso-config.js';

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
        const issuer = `https://${domains.sso}/dex/realms/${ssoRealm}`;
        this.log(`Local SSO settings:

  Issuer:        ${issuer}
  Discovery:     ${issuer}/.well-known/openid-configuration
  Client ID:     ${ssoClientId}
  Client secret: ${ssoClientSecret}
  Redirect URI:  ${args.redirectUri ?? `https://<organization-id>.${domains.api}/openid/callback`}

Test user:

  Email:         ${ssoUserEmail}
  Password:      ${ssoUserPassword}
  Name:          ${ssoUserName}

Admin console:

  URL:           https://${domains.sso}/dex/admin
  Username:      ${ssoAdminUser}
  Password:      ${ssoAdminPassword}

Commands:

  stam sso start "${args.redirectUri ?? `https://<organization-id>.${domains.api}/openid/callback`}"`);
    }
}
