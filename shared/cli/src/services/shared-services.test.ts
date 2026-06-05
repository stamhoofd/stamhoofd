import { beforeEach, describe, expect, it, vi } from 'vitest';
import { caddyAdminPort, caddyHttpPort, caddyHttpsPort, caddyUnprivilegedHttpPort, caddyUnprivilegedHttpsPort, localFilesAccessKey, localFilesSecretKey, localhostPort, localhostPortMapping, maildevPassword, maildevUsername, maildevInternalHttpPort, maildevInternalSmtpPort, mysqlDataVolume, mysqlInternalPort, rustfsInternalApiPort } from '../config/shared-service-config.js';
import { buildSharedServiceProfile } from '../config/shared-service-profile.js';
import { run } from '../runtime/command-runner.js';
import { CaddyService } from './definitions/caddy-service.js';
import { CorednsService } from './definitions/coredns-service.js';
import { MaildevService } from './definitions/maildev-service.js';
import { MysqlService } from './definitions/mysql-service.js';
import { RustfsService } from './definitions/rustfs-service.js';
import { ContainerRuntime } from './docker.js';
import { tailSharedLogs } from './shared-services.js';

vi.mock('../runtime/command-runner.js', () => ({
    run: vi.fn(),
}));

vi.mock('./docker.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('./docker.js')>(),
    getContainerRuntime: vi.fn(async () => ContainerRuntime.Podman),
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
        expect(CorednsService.dockerArgs('/tmp/Corefile', 1053, { disableLabel: true })).toContain('--security-opt');
        expect(CorednsService.dockerArgs('/tmp/Corefile', 1053)).toContain('127.0.0.1:1053:53/udp');
        expect(CorednsService.dockerArgs('/tmp/Corefile', 1053)).toContain('127.0.0.1:1053:53/tcp');
        expect(CorednsService.dockerArgs('/tmp/Corefile', 1053)).toContain('/tmp/Corefile:/Corefile:ro');
        expect(CaddyService.dockerArgs('/tmp/caddy.json', '/tmp/data', buildSharedServiceProfile(ContainerRuntime.Docker, 'linux'))).toContain('/tmp/caddy.json:/etc/caddy/caddy.json:ro');
    });

    it('builds macOS Docker bridge args for Caddy', () => {
        const args = CaddyService.dockerArgs('/tmp/caddy.json', '/tmp/data', buildSharedServiceProfile(ContainerRuntime.Docker, 'darwin'));

        expect(args).toContain(localhostPortMapping(80, 80));
        expect(args).toContain(localhostPortMapping(443, 443));
        expect(args).not.toContain('--network');
    });

    it('builds Linux rootless Caddy args with host networking on high ports', () => {
        const args = CaddyService.dockerArgs('/tmp/caddy.json', '/tmp/data', buildSharedServiceProfile(ContainerRuntime.Docker, 'linux'));

        expect(args).toContain('--network');
        expect(args).toContain('host');
        expect(args).not.toContain(localhostPortMapping(80, 80));
    });

    it('shows Caddy redirects and admin port in service details', async () => {
        const detail = await new CaddyService().getDetail();

        expect(detail).toContain(`HTTP ${localhostPort(caddyHttpPort)} -> ${localhostPort(caddyUnprivilegedHttpPort)}`);
        expect(detail).toContain(`HTTPS ${localhostPort(caddyHttpsPort)} -> ${localhostPort(caddyUnprivilegedHttpsPort)}`);
        expect(detail).toContain(`admin ${localhostPort(caddyAdminPort)}`);
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
