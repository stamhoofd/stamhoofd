import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localFilesAccessKey, localFilesSecretKey, localhostPortMapping, maildevPassword, maildevUsername, maildevInternalHttpPort, maildevInternalSmtpPort, mysqlDataVolume, mysqlInternalPort, rustfsInternalApiPort } from '../config/shared-service-config.js';
import { run } from '../runtime/command-runner.js';
import { CaddyService } from './definitions/caddy-service.js';
import { CorednsService } from './definitions/coredns-service.js';
import { MaildevService } from './definitions/maildev-service.js';
import { MysqlService } from './definitions/mysql-service.js';
import { RustfsService } from './definitions/rustfs-service.js';
import { tailSharedLogs } from './shared-services.js';

vi.mock('../runtime/command-runner.js', () => ({
    run: vi.fn(),
}));

vi.mock('./docker.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('./docker.js')>(),
    getContainerRuntime: vi.fn(async () => 'podman'),
}));

describe('shared service Docker args', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('builds MySQL args with local port binding and volume', () => {
        expect(MysqlService.dockerArgs(3307)).toContain(localhostPortMapping(3307, mysqlInternalPort));
        expect(MysqlService.dockerArgs(3307)).toContain(`${mysqlDataVolume}:/var/lib/mysql`);
    });

    it('builds MailDev args with credentials', () => {
        const args = MaildevService.dockerArgs(1026, 1081);

        expect(args).toContain(localhostPortMapping(1026, maildevInternalSmtpPort));
        expect(args).toContain(localhostPortMapping(1081, maildevInternalHttpPort));
        expect(args).toContain(maildevUsername);
        expect(args).toContain(maildevPassword);
    });

    it('builds RustFS args with local credentials', () => {
        const args = RustfsService.dockerArgs(9002, 9003);

        expect(args).toContain(localhostPortMapping(9002, rustfsInternalApiPort));
        expect(args).toContain(`RUSTFS_ACCESS_KEY=${localFilesAccessKey}`);
        expect(args).toContain(`RUSTFS_SECRET_KEY=${localFilesSecretKey}`);
    });

    it('builds CoreDNS and Caddy args from generated paths', () => {
        expect(CorednsService.dockerArgs('/tmp/Corefile', { disableLabel: true })).toContain('--security-opt');
        expect(CorednsService.dockerArgs('/tmp/Corefile')).toContain('127.0.0.1:1053:53/udp');
        expect(CorednsService.dockerArgs('/tmp/Corefile')).toContain('127.0.0.1:1053:53/tcp');
        expect(CorednsService.dockerArgs('/tmp/Corefile')).toContain('/tmp/Corefile:/Corefile:ro');
        expect(CaddyService.dockerArgs('/tmp/caddy.json', '/tmp/data')).toContain('/tmp/caddy.json:/etc/caddy/caddy.json:ro');
    });

    it('tails all shared service logs through concurrently', async () => {
        await tailSharedLogs();

        expect(run).toHaveBeenCalledWith('yarn', [
            '-s',
            'concurrently',
            '-n',
            'MySQL,MailDev,RustFS,CoreDNS,Caddy',
            'podman logs -f stamhoofd-mysql',
            'podman logs -f stamhoofd-maildev',
            'podman logs -f stamhoofd-rustfs',
            'podman logs -f stamhoofd-coredns',
            'podman logs -f stamhoofd-caddy',
        ], { allowFailure: true });
    });
});
