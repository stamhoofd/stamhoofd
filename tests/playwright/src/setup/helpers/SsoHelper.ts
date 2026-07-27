import { createContext, SsoService } from '@stamhoofd/cli';
import { CaddyConfigHelper } from './CaddyConfigHelper.js';

/**
 * The local SSO server (Keycloak) from the CLI, started once per e2e run and shared by all workers.
 * It runs under its own container name, port and hostname, so it never interferes with the SSO
 * server `stam sso start` manages for manual testing.
 *
 * Configure it in a test with `CaddyConfigHelper.getSsoIssuer()` plus the client credentials
 * exported by `@stamhoofd/cli` (ssoClientId, ssoClientSecret).
 */
export class SsoHelper {
    private static service = new SsoService({
        name: 'playwright',
        port: CaddyConfigHelper.getSsoPort(),
        hostname: CaddyConfigHelper.getSsoDomain(),
    });

    /**
     * Requires the Caddy route for the SSO host to be configured already: readiness is checked
     * through Caddy, the same way the backends reach the server.
     */
    static async start(): Promise<void> {
        const context = await createContext({ env: 'stamhoofd', verbose: false });
        await this.service.start(context, {
            redirectUris: CaddyConfigHelper.getSsoRedirectUris(),
            background: true,
        });
        await this.service.waitUntilReady(context);
    }

    static async stop(): Promise<void> {
        const context = await createContext({ env: 'stamhoofd', verbose: false });
        await this.service.stop(context);
    }
}
