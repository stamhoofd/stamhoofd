import type { CliContext } from '../../context/create-context.js';
import { buildPorts } from '../../context/ports.js';
import { mysqlContainer, mysqlDataVolume, mysqlImage, mysqlInternalPort, mysqlRootPassword, mysqlRootUser, mysqlServerArgs, localhostPort, localhostPortMapping } from '../../config/shared-service-config.js';
import * as docker from '../docker.js';
import { SharedDockerService } from '../docker-service.js';
import type { ServiceStatus } from '../service.js';

export class MysqlService extends SharedDockerService {
    static readonly container = mysqlContainer;

    readonly key = 'mysql';
    readonly name = 'MySQL';

    getContainer(): string {
        return MysqlService.container;
    }

    getDetail(context: CliContext): string {
        const ports = buildPorts(context);
        return localhostPort(ports.mysql);
    }

    getLogin(): string {
        return `${mysqlRootUser} / ${mysqlRootPassword}`;
    }

    getDockerArgs(context: CliContext): string[] {
        const ports = buildPorts(context);
        return MysqlService.dockerArgs(ports.mysql);
    }

    async beforeRun(context: CliContext): Promise<void> {
        await docker.createVolume(mysqlDataVolume, context.verbose);
    }

    async afterRun(context: CliContext): Promise<void> {
        await docker.waitForMysql(MysqlService.container, context.verbose);
    }

    override alreadyRunningMessage(status: ServiceStatus): string {
        return `MySQL already running on ${status.detail}`;
    }

    override startedMessage(context: CliContext): string {
        const ports = buildPorts(context);
        return `MySQL started on ${localhostPort(ports.mysql)}`;
    }

    static dockerArgs(port: number): string[] {
        return ['run', '-d', '--name', MysqlService.container, '-e', `MYSQL_ROOT_PASSWORD=${mysqlRootPassword}`, '-p', localhostPortMapping(port, mysqlInternalPort), '-v', `${mysqlDataVolume}:/var/lib/mysql`, mysqlImage, ...mysqlServerArgs()];
    }
}

export const mysqlService = new MysqlService();
