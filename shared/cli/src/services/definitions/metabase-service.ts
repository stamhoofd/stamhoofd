import { buildDomains } from '../../config/build-config.js';
import { dockerHostGateway, localIpv4Host, localhostPortMapping, metabaseAppDatabase, metabaseContainer, metabaseImage, metabaseInternalPort, mysqlContainer, mysqlRootPassword, mysqlRootUser } from '../../config/shared-service-config.js';
import type { CliContext } from '../../context/create-context.js';
import { buildPorts } from '../../context/ports.js';
import { link } from '../../runtime/ux.js';
import { SharedDockerService } from '../docker-service.js';
import * as docker from '../docker.js';

export class MetabaseService extends SharedDockerService {
    static readonly container = metabaseContainer;

    readonly key = 'metabase';
    readonly name = 'Metabase';

    getContainer(): string {
        return MetabaseService.container;
    }

    getDetail(context: CliContext): string {
        const url = `https://${buildDomains(context).metabase}`;
        return link(url, url);
    }

    /**
     * Metabase has no seeded account: the first visit opens a setup wizard that creates the admin
     * user. See buildMetabaseConfigOutput for what to fill in there.
     */
    getLogin(): string {
        return 'setup wizard';
    }

    /**
     * The application database lives on the shared MySQL container, so that has to be up first.
     * Metabase creates its own schema on boot, but not the database itself.
     */
    async beforeRun(context: CliContext): Promise<void> {
        if (!await docker.containerIsRunning(mysqlContainer)) {
            throw new Error(`${this.name} stores its data on the shared MySQL container, which is not running. Start it with: stam services up`);
        }
        await docker.run(['exec', mysqlContainer, 'mysql', `-h${localIpv4Host}`, `-u${mysqlRootUser}`, `-p${mysqlRootPassword}`, '-e', `CREATE DATABASE IF NOT EXISTS \`${metabaseAppDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`], { quiet: true, verbose: context.verbose });
    }

    async afterRun(context: CliContext): Promise<void> {
        await this.waitUntilReady(context);
    }

    getDockerArgs(context: CliContext): string[] {
        const ports = buildPorts(context);
        return MetabaseService.dockerArgs(ports.metabase, ports.mysql, `https://${buildDomains(context).metabase}`);
    }

    override startedMessage(context: CliContext): string {
        return `Metabase started on https://${buildDomains(context).metabase}`;
    }

    /**
     * Metabase accepts TCP connections long before it finished migrating its application database,
     * and answers 503 on /api/health until it is done. Polls the published port directly rather
     * than the Caddy hostname, so this also works when only the container was started.
     */
    async waitUntilReady(context: CliContext, options: { timeoutMs?: number } = {}): Promise<void> {
        const url = `http://${localIpv4Host}:${buildPorts(context).metabase}/api/health`;
        const timeoutMs = options.timeoutMs ?? 300_000;
        const start = Date.now();
        let lastError = 'no response';

        while (Date.now() - start < timeoutMs) {
            if (!await docker.containerIsRunning(MetabaseService.container)) {
                throw new Error(`${this.name} stopped while starting up. Check: stam metabase logs`);
            }
            try {
                const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
                if (response.ok) {
                    return;
                }
                lastError = `status ${response.status}`;
            }
            catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
            }
            await new Promise(resolve => setTimeout(resolve, 1_000));
        }

        throw new Error(`Timed out waiting for ${this.name} to become ready at ${url} (${lastError})`);
    }

    /**
     * `mysqlPort` is the host port the shared MySQL container publishes: Metabase reaches it over
     * the Docker host gateway. Linux Docker has no built-in host.docker.internal, so it is mapped
     * explicitly (Docker Desktop and Podman accept the same flag and keep working).
     */
    static dockerArgs(port: number, mysqlPort: number, siteUrl: string): string[] {
        return [
            'run', '-d',
            '--name', MetabaseService.container,
            '--add-host', `${dockerHostGateway}:host-gateway`,
            '-p', localhostPortMapping(port, metabaseInternalPort),
            '-e', 'MB_DB_TYPE=mysql',
            '-e', `MB_DB_HOST=${dockerHostGateway}`,
            '-e', `MB_DB_PORT=${mysqlPort}`,
            '-e', `MB_DB_DBNAME=${metabaseAppDatabase}`,
            '-e', `MB_DB_USER=${mysqlRootUser}`,
            '-e', `MB_DB_PASS=${mysqlRootPassword}`,
            '-e', `MB_SITE_URL=${siteUrl}`,
            metabaseImage,
        ];
    }
}

export const metabaseService = new MetabaseService();
