import { buildDatabases, buildDomains } from '../../config/build-config.js';
import { dockerHostGateway, localIpv4Host, localhostPortMapping, metabaseAppDatabase, metabaseContainer, metabaseImage, metabaseInternalPort, mysqlContainer, mysqlRootPassword, mysqlRootUser } from '../../config/shared-service-config.js';
import type { CliContext } from '../../context/create-context.js';
import { buildPorts } from '../../context/ports.js';
import { link } from '../../runtime/ux.js';
import { SharedDockerService } from '../docker-service.js';
import * as docker from '../docker.js';
import { MetabaseApi, MetabaseApiError } from '../metabase-api.js';
import { metabaseAdmin, metabaseAdminEmail, metabaseAdminPassword, metabaseDataSourceName, metabaseHiddenTables, metabaseReportCollectionName, metabaseReportDashboardName } from '../metabase-config.js';
import type { ReportSyncResult } from '../metabase-report.js';
import { syncReport } from '../metabase-report.js';
import { loadReportDefinition } from '../report-definition.js';

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

    getLogin(): string {
        return `${metabaseAdminEmail} / ${metabaseAdminPassword}`;
    }

    /**
     * The application database lives on the shared MySQL container, so that has to be up first.
     * Metabase creates its own schema on boot, but not the database itself.
     */
    async beforeRun(context: CliContext): Promise<void> {
        await this.assertMysqlRunning();
        await this.createMysqlDatabase(context, metabaseAppDatabase);
    }

    /**
     * Register the platform statistics database of the selected environment as a data source, so a
     * fresh Metabase is immediately usable and switching environments needs no clicking. Creates
     * the MySQL database as well: Metabase refuses a connection to a database that does not exist.
     *
     * Runs on every start rather than only on a fresh container, so `--env keeo` after `--env ravot`
     * adds the second data source to the same Metabase.
     */
    async provision(context: CliContext): Promise<{ database: string; dataSource: string; created: boolean; removedSampleDatabase: boolean; hiddenTables: string[]; tableCount: number }> {
        const { api, id, created, database, dataSource } = await this.connectDataSource(context);

        await api.syncDatabaseSchema(id);
        const { removed: removedSampleDatabase } = await api.removeSampleDatabase();
        const tableCount = await this.countTables(context, database);
        const hiddenTables = tableCount === 0 ? [] : await api.hideTables(id, metabaseHiddenTables);

        return { database, dataSource, created, removedSampleDatabase, hiddenTables, tableCount };
    }

    /**
     * Recreate the ledenstatistieken dashboard on top of the statistics data source.
     */
    async provisionReport(context: CliContext): Promise<ReportSyncResult & { database: string; dataSource: string; tableCount: number }> {
        const { api, id, database, dataSource } = await this.connectDataSource(context);
        const tabs = await loadReportDefinition(context);

        const result = await syncReport(api, id, tabs, metabaseReportCollectionName(context.env), metabaseReportDashboardName);
        return { ...result, database, dataSource, tableCount: await this.countTables(context, database) };
    }

    /**
     * Sign in and make sure the statistics database of the selected environment is registered. Also
     * creates the MySQL database: Metabase refuses a connection to a database that does not exist.
     */
    private async connectDataSource(context: CliContext): Promise<{ api: MetabaseApi; id: number; created: boolean; database: string; dataSource: string }> {
        await this.assertMysqlRunning();

        const database = buildDatabases(context).platformStatistics;
        const dataSource = metabaseDataSourceName(context.env);
        await this.createMysqlDatabase(context, database);

        const api = new MetabaseApi(`http://${localIpv4Host}:${buildPorts(context).metabase}`);
        try {
            await api.authenticate(metabaseAdmin);
        }
        catch (error) {
            if (error instanceof MetabaseApiError && error.status === 401) {
                throw new Error(`Cannot sign in to the local Metabase as ${metabaseAdminEmail}: this instance was set up with a different account. Set METABASE_ADMIN_EMAIL and METABASE_ADMIN_PASSWORD to those credentials, or start over with: stam clean metabase`, { cause: error });
            }
            throw error;
        }

        const { id, created } = await api.ensureDatabase({
            name: dataSource,
            host: dockerHostGateway,
            port: buildPorts(context).mysql,
            database,
            user: mysqlRootUser,
            password: mysqlRootPassword,
        });

        return { api, id, created, database, dataSource };
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

    private async assertMysqlRunning(): Promise<void> {
        if (!await docker.containerIsRunning(mysqlContainer)) {
            throw new Error(`${this.name} stores its data on the shared MySQL container, which is not running. Start it with: stam services up`);
        }
    }

    /**
     * The statistics schema is created by the backend migrations, not by this command, so a database
     * without tables means those have not run yet.
     */
    private async countTables(context: CliContext, database: string): Promise<number> {
        const result = await docker.run(['exec', mysqlContainer, 'mysql', `-h${localIpv4Host}`, `-u${mysqlRootUser}`, `-p${mysqlRootPassword}`, '-N', '-B', '-e', `SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${database.replaceAll("'", "''")}'`], { capture: true, quiet: true, verbose: context.verbose });
        return Number.parseInt(result.stdout.trim(), 10) || 0;
    }

    private async createMysqlDatabase(context: CliContext, database: string): Promise<void> {
        await docker.run(['exec', mysqlContainer, 'mysql', `-h${localIpv4Host}`, `-u${mysqlRootUser}`, `-p${mysqlRootPassword}`, '-e', `CREATE DATABASE IF NOT EXISTS \`${database.replaceAll('`', '``')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`], { quiet: true, verbose: context.verbose });
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
            // Skip the demo database and example dashboards Metabase would otherwise create on setup.
            '-e', 'MB_LOAD_SAMPLE_CONTENT=false',
            metabaseImage,
        ];
    }
}

export const metabaseService = new MetabaseService();
