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
    /**
     * Built on demand, never cached: the hostname and port follow the slots this run reserved,
     * which are only known once the Caddy routes are configured.
     */
    private static get service() {
        return new SsoService({
            name: CaddyConfigHelper.getSsoVariantName(),
            port: CaddyConfigHelper.getSsoPort(),
            hostname: CaddyConfigHelper.getSsoDomain(),
        });
    }

    /**
     * Requires the Caddy route for the SSO host to be configured already: readiness is checked
     * through Caddy, the same way the backends reach the server.
     */
    static async start(workerCount: number): Promise<void> {
        const context = await createContext({ env: 'stamhoofd', verbose: false });
        const service = this.service;

        // Servers of earlier runs of this worktree that crashed before their teardown: their name
        // carries the slots they reserved, so nothing else would ever replace them.
        await service.removeOtherVariants(context, CaddyConfigHelper.GROUP_PREFIX);

        await service.start(context, {
            redirectUris: CaddyConfigHelper.getSsoRedirectUris(workerCount),
            background: true,
        });
        await service.waitUntilReady(context);
    }

    static async stop(): Promise<void> {
        const context = await createContext({ env: 'stamhoofd', verbose: false });
        await this.service.stop(context);
    }
}
