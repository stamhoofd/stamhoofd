import { buildDomains } from '../../config/build-config.js';
import { buildPorts } from '../../context/ports.js';
import { keycloakImage, localIpv4Host, ssoInternalPort } from '../../config/shared-service-config.js';
import type { CliContext } from '../../context/create-context.js';
import { DockerService } from '../docker-service.js';
import { ssoAdminPassword, ssoAdminUser, ssoRealm, writeKeycloakRealm } from '../sso-config.js';

type SsoStartOptions = {
    /**
     * Every URI the client is allowed to redirect back to. Keycloak rejects the authorization
     * request when the redirect URI the backend sends is not listed here.
     */
    redirectUris: string[];
    background?: boolean;
};

/**
 * Runs a second SSO server next to the one `stam sso start` manages. The Playwright suite needs
 * its own hostname, port, container and realm file so an e2e run never restarts (or is restarted
 * by) the SSO server a developer started for manual testing.
 */
export type SsoServiceVariant = {
    /** Suffix for the container name, e.g. 'playwright' → <instance>-keycloak-playwright */
    name: string;
    /** Host port the container publishes on. */
    port: number;
    /** Public hostname the server is reachable on (proxied by Caddy). */
    hostname: string;
};

type SsoPrepared = {
    importDir: string;
};

export class SsoService extends DockerService<SsoStartOptions, SsoPrepared> {
    readonly key: string;
    readonly name: string;
    override readonly runQuiet = false;

    constructor(private readonly variant: SsoServiceVariant | null = null) {
        super();
        this.key = variant ? `sso-${variant.name}` : 'sso';
        this.name = variant ? `SSO (${variant.name})` : 'SSO';
    }

    getContainer(context: CliContext): string {
        return SsoService.container(context, this.variant?.name);
    }

    getDetail(context: CliContext): string {
        return `https://${this.getHostname(context)}/dex/admin`;
    }

    /**
     * The OpenID Connect issuer of the imported realm: what you configure as the issuer in the
     * Stamhoofd SSO settings.
     */
    getIssuer(context: CliContext): string {
        return `https://${this.getHostname(context)}/dex/realms/${ssoRealm}`;
    }

    async prepare(context: CliContext, options: SsoStartOptions): Promise<SsoPrepared> {
        return { importDir: await writeKeycloakRealm(context, options.redirectUris, { dirName: this.variant ? `keycloak-${this.variant.name}` : undefined }) };
    }

    canReuse(): boolean {
        return false;
    }

    getDockerArgs(context: CliContext, options: SsoStartOptions, prepared: SsoPrepared): string[] {
        const args = ['run'];
        if (options.background) {
            args.push('-d');
        }
        else {
            args.push('--rm');
        }
        args.push('--name', this.getContainer(context), '-p', `${localIpv4Host}:${this.getPort(context)}:${ssoInternalPort}`, '-e', `KC_BOOTSTRAP_ADMIN_USERNAME=${ssoAdminUser}`, '-e', `KC_BOOTSTRAP_ADMIN_PASSWORD=${ssoAdminPassword}`, '-e', 'KC_HTTP_RELATIVE_PATH=/dex', '-v', `${prepared.importDir}:/opt/keycloak/data/import:ro,Z`, keycloakImage, 'start-dev', '--import-realm', '--hostname', `https://${this.getHostname(context)}/dex`, '--proxy-headers=xforwarded');
        return args;
    }

    /**
     * Keycloak accepts TCP connections well before the realm import finished, so poll the realm's
     * discovery document instead of the container state. Goes through Caddy, which is how the
     * backend reaches the server too.
     *
     * The document has to name our issuer: Caddy answers an empty 200 for a host it has no route
     * for, so a bare status check would pass while nothing is reachable at all.
     */
    async waitUntilReady(context: CliContext, options: { timeoutMs?: number } = {}): Promise<void> {
        const issuer = this.getIssuer(context);
        const url = `${issuer}/.well-known/openid-configuration`;
        const timeoutMs = options.timeoutMs ?? 120_000;
        const start = Date.now();
        let lastError = 'no response';

        while (Date.now() - start < timeoutMs) {
            try {
                const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
                if (!response.ok) {
                    lastError = `status ${response.status}`;
                }
                else {
                    const body = await response.text();
                    const discovered = parseIssuer(body);
                    if (discovered === issuer) {
                        return;
                    }
                    lastError = discovered === undefined
                        ? `response is not an OpenID discovery document (${body.length} bytes): is Caddy routing ${new URL(issuer).host}?`
                        : `discovery document reports issuer ${discovered}`;
                }
            }
            catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        throw new Error(`Timed out waiting for ${this.name} to become ready at ${url} (${lastError})`);
    }

    private getHostname(context: CliContext): string {
        return this.variant?.hostname ?? buildDomains(context).sso;
    }

    private getPort(context: CliContext): number {
        return this.variant?.port ?? buildPorts(context).sso;
    }

    static container(context: { instance: { name: string } }, variant?: string): string {
        return `${context.instance.name}-keycloak${variant ? `-${variant}` : ''}`;
    }
}

export const ssoService = new SsoService();

function parseIssuer(body: string): string | undefined {
    try {
        const parsed = JSON.parse(body) as { issuer?: unknown };
        return typeof parsed.issuer === 'string' ? parsed.issuer : undefined;
    }
    catch {
        return undefined;
    }
}
