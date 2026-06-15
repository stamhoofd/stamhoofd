import fs from 'node:fs/promises';
import dns from 'node:dns/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from '../runtime/command-runner.js';
import { confirm } from '../runtime/ux.js';
import { corednsService } from '../services/definitions/coredns-service.js';
import * as docker from '../services/docker.js';
import { checkSetup, getRecommendedSetupFixes, isSetupReady, printSetupReport, runSetup, setupCaddy, setupDns, SetupAutomaticFixKey } from './setup-machine.js';
import type { CheckResult, SetupReport } from './setup-machine.js';
import { checkNodeVersion, setupNodeVersion } from './setup-node.js';

const dnsResolver = vi.hoisted(() => ({
    resolve4: vi.fn(),
    setServers: vi.fn(),
}));

vi.mock('node:dns/promises', () => ({
    default: {
        lookup: vi.fn(),
        Resolver: vi.fn(() => dnsResolver),
    },
}));

vi.mock('../runtime/command-runner.js', () => ({
    run: vi.fn(),
}));

vi.mock('../services/definitions/coredns-service.js', () => ({
    corednsService: { status: vi.fn() },
}));

vi.mock('../services/docker.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('../services/docker.js')>(),
    getContainerRuntime: vi.fn(),
    containerIsRunning: vi.fn(),
}));

vi.mock('../runtime/ux.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('../runtime/ux.js')>(),
    confirm: vi.fn(),
}));

vi.mock('./setup-node.js', () => ({
    checkNodeVersion: vi.fn(),
    setupNodeVersion: vi.fn(),
}));

describe('setup machine workflow', () => {
    const platform = process.platform;

    beforeEach(() => {
        vi.clearAllMocks();
        setPlatform(platform);
        vi.mocked(docker.getContainerRuntime).mockResolvedValue(docker.ContainerRuntime.Docker);
        vi.mocked(checkNodeVersion).mockResolvedValue({
            ok: true,
            current: 'v22.22.3',
            expected: 'v22.22.3',
            details: 'v22.22.3 matches .nvmrc',
        });
        vi.mocked(docker.containerIsRunning).mockResolvedValue(false);
        vi.mocked(corednsService.status).mockResolvedValue({ name: 'CoreDNS', running: true, detail: '127.0.0.1:53' });
        dnsResolver.resolve4.mockResolvedValue(['127.0.0.1']);
        dnsResolver.setServers.mockImplementation(() => undefined);
    });

    it('recommends automatic fixes while prerequisites are available', () => {
        const report = setupReport({
            dns: missingAutomatic(SetupAutomaticFixKey.Dns, 'Configure local DNS'),
            cert: missingAutomatic(SetupAutomaticFixKey.Cert, 'Trust local HTTPS certificates'),
        });

        expect(getRecommendedSetupFixes(report)).toEqual([
            { key: SetupAutomaticFixKey.Dns, label: 'Configure local DNS' },
            { key: SetupAutomaticFixKey.Cert, label: 'Trust local HTTPS certificates' },
        ]);
    });

    it('offers to install the configured Node.js version before other setup fixes', async () => {
        vi.mocked(checkNodeVersion).mockResolvedValue({
            ok: false,
            current: 'v22.22.3',
            expected: 'v24.1.0',
            details: 'v22.22.3 is active, but .nvmrc requires v24.1.0',
        });
        vi.mocked(confirm).mockResolvedValue(true);
        setPlatform('linux');
        mockSetupCommands({
            dns: 'Global: 127.0.0.1:1053\n',
            domains: 'Global: ~stamhoofd\n',
        });

        await runSetup({ rootDir: '/repo', verbose: true } as any);

        expect(setupNodeVersion).toHaveBeenCalledWith('/repo', { verbose: true });
    });

    it('only recommends the Node.js fix when the active version is wrong', () => {
        const report = setupReport({
            node: missingAutomatic(SetupAutomaticFixKey.Node, 'Install Node.js v24.1.0'),
            dns: missingAutomatic(SetupAutomaticFixKey.Dns, 'Configure local DNS'),
        });

        expect(getRecommendedSetupFixes(report)).toEqual([
            { key: SetupAutomaticFixKey.Node, label: 'Install Node.js v24.1.0' },
        ]);
    });

    it('does not recommend automatic fixes after a missing manual prerequisite', () => {
        const report = setupReport({
            caddy: missingManual('caddy not found'),
            dns: missingAutomatic(SetupAutomaticFixKey.Dns, 'Configure local DNS'),
            cert: missingAutomatic(SetupAutomaticFixKey.Cert, 'Trust local HTTPS certificates'),
        });

        expect(getRecommendedSetupFixes(report)).toEqual([]);
    });

    it('keeps earlier automatic fixes but stops at the first manual blocker', () => {
        const report = setupReport({
            dns: missingAutomatic(SetupAutomaticFixKey.Dns, 'Configure local DNS'),
            cert: missingManual('Caddy local CA not found'),
        });

        expect(getRecommendedSetupFixes(report)).toEqual([
            { key: SetupAutomaticFixKey.Dns, label: 'Configure local DNS' },
        ]);
    });

    it('reports ready only when all setup checks are ok', () => {
        expect(isSetupReady(setupReport({}))).toBe(true);
        expect(isSetupReady(setupReport({ docker: missingManual('docker missing') }))).toBe(false);
    });

    it('recommends DNS setup when local DNS is not configured', async () => {
        mockSetupCommands({
            dns: 'Global: 1.1.1.1\n',
            domains: 'Global:\n',
        });

        const report = await checkSetup({ verbose: false } as any);

        expect(report.dns).toMatchObject({
            ok: false,
            manualFix: 'stam setup dns',
            automaticFix: { key: SetupAutomaticFixKey.Dns, label: 'Configure local DNS' },
        });
        expect(corednsService.status).not.toHaveBeenCalled();
    });

    it('recommends starting all shared services when DNS is configured but CoreDNS is stopped', async () => {
        mockSetupCommands({
            dns: 'Global: 127.0.0.1:1053\n',
            domains: 'Global: ~stamhoofd\n',
            query: '',
        });
        vi.mocked(corednsService.status).mockResolvedValue({ name: 'CoreDNS', running: false, detail: '127.0.0.1:1053' });

        const report = await checkSetup({ verbose: false } as any);

        expect(report.dns).toMatchObject({
            ok: false,
            manualFix: 'stam services up',
            automaticFix: { key: SetupAutomaticFixKey.Services, label: 'Start shared services' },
        });
    });

    it('does not recommend DNS setup when DNS is configured and CoreDNS is running but resolution still fails', async () => {
        mockSetupCommands({
            dns: 'Global: 127.0.0.1:1053\n',
            domains: 'Global: ~stamhoofd\n',
            query: '',
        });
        vi.mocked(corednsService.status).mockResolvedValue({ name: 'CoreDNS', running: true, detail: '127.0.0.1:1053' });

        const report = await checkSetup({ verbose: false } as any);

        expect(report.dns).toMatchObject({
            ok: false,
            manualFix: 'stam setup dns',
        });
        expect(report.dns.automaticFix).toBeUndefined();
    });

    it('asks to run recommended fixes with yes as the default', async () => {
        const messages: string[] = [];
        const original = console.log;
        console.log = (message?: unknown) => {
            messages.push(typeof message === 'string' ? message : '');
        };
        mockSetupCommands({
            dns: 'Global: 127.0.0.1:1053\n',
            domains: 'Global: ~stamhoofd\n',
            query: '',
        });
        vi.mocked(corednsService.status).mockResolvedValue({ name: 'CoreDNS', running: false, detail: '127.0.0.1:1053' });
        vi.mocked(confirm).mockResolvedValue(false);

        try {
            await runSetup({ verbose: false } as any);
        }
        finally {
            console.log = original;
        }

        expect(confirm).toHaveBeenCalledWith('Run recommended fixes now?', { default: true });
        expect(messages).not.toContain('?');
    });

    it('requires privileged port redirects on Linux for Docker', async () => {
        mockSetupCommands({
            dns: 'Global: 127.0.0.1:1053\n',
            domains: 'Global: ~stamhoofd\n',
            missingRedirects: true,
        });

        const report = await checkSetup({ verbose: false } as any);

        expect(report.privilegedPorts).toMatchObject({
            ok: false,
            automaticFix: { key: SetupAutomaticFixKey.PrivilegedPorts, label: 'Configure privileged port redirects' },
        });
    });

    it('requires privileged port redirects on Linux for Podman', async () => {
        vi.mocked(docker.getContainerRuntime).mockResolvedValue(docker.ContainerRuntime.Podman);
        mockSetupCommands({
            dns: 'Global: 127.0.0.1:1053\n',
            domains: 'Global: ~stamhoofd\n',
            missingRedirects: true,
        });

        const report = await checkSetup({ verbose: false } as any);

        expect(report.privilegedPorts).toMatchObject({
            ok: false,
            automaticFix: { key: SetupAutomaticFixKey.PrivilegedPorts, label: 'Configure privileged port redirects' },
        });
    });

    it('skips privileged port redirects on macOS', async () => {
        setPlatform('darwin');
        mockSetupCommands({
            resolver: 'nameserver 127.0.0.1\n',
        });

        const report = await checkSetup({ verbose: false } as any);

        expect(report.privilegedPorts).toEqual({ ok: true, details: 'not needed for docker' });
    });

    it('checks macOS resolver contents', async () => {
        setPlatform('darwin');
        mockSetupCommands({
            resolver: 'nameserver 127.0.0.1\n',
        });
        vi.mocked(corednsService.status).mockResolvedValue({ name: 'CoreDNS', running: true, detail: '127.0.0.1:53' });

        const report = await checkSetup({ verbose: false } as any);

        expect(report.dns).toMatchObject({ ok: true });
        expect(fs.readFile).toHaveBeenCalledWith('/etc/resolver/stamhoofd', 'utf8');
        expect(dnsResolver.setServers).toHaveBeenCalledWith(['127.0.0.1']);
        expect(dnsResolver.resolve4).toHaveBeenCalledWith('dashboard.stamhoofd');
    });

    it('does not wait for macOS resolver lookup when CoreDNS is stopped', async () => {
        setPlatform('darwin');
        mockSetupCommands({
            resolver: 'nameserver 127.0.0.1\n',
        });
        vi.mocked(corednsService.status).mockResolvedValue({ name: 'CoreDNS', running: false, detail: '127.0.0.1:53' });

        const report = await checkSetup({ verbose: false } as any);

        expect(report.dns).toMatchObject({
            ok: false,
            manualFix: 'stam services up',
            automaticFix: { key: SetupAutomaticFixKey.Services, label: 'Start shared services' },
        });
        expect(dns.lookup).not.toHaveBeenCalled();
        expect(dnsResolver.resolve4).not.toHaveBeenCalled();
    });

    it('reports macOS direct CoreDNS query failures without OS resolver lookup', async () => {
        setPlatform('darwin');
        mockSetupCommands({
            resolver: 'nameserver 127.0.0.1\n',
        });
        vi.mocked(corednsService.status).mockResolvedValue({ name: 'CoreDNS', running: true, detail: '127.0.0.1:53' });
        dnsResolver.resolve4.mockResolvedValue([]);

        const report = await checkSetup({ verbose: false } as any);

        expect(report.dns).toMatchObject({
            ok: false,
            manualFix: 'stam setup dns',
        });
        expect(dns.lookup).not.toHaveBeenCalled();
    });

    it('reports mismatching macOS resolver contents as manual DNS problem', async () => {
        setPlatform('darwin');
        mockSetupCommands({
            resolver: 'nameserver 10.0.0.1\n',
        });

        const report = await checkSetup({ verbose: false } as any);

        expect(report.dns).toMatchObject({
            ok: false,
            manualFix: 'stam setup dns',
        });
        expect(report.dns.automaticFix).toBeUndefined();
    });

    it('asks before overwriting mismatching macOS resolver contents', async () => {
        setPlatform('darwin');
        mockSetupCommands({
            resolver: 'nameserver 10.0.0.1\n',
        });
        vi.mocked(confirm).mockResolvedValue(false);

        await setupDns({ yes: false, dryRun: false, verbose: false });

        expect(confirm).toHaveBeenCalledWith('Overwrite /etc/resolver/stamhoofd?', { default: false });
        expect(run).not.toHaveBeenCalledWith('sudo', ['cp', expect.any(String), '/etc/resolver/stamhoofd'], expect.anything());
    });

    it('offers Homebrew Caddy installation on macOS only', async () => {
        setPlatform('darwin');
        mockSetupCommands({
            resolver: 'nameserver 127.0.0.1\n',
            caddyMissing: true,
        });

        const macReport = await checkSetup({ verbose: false } as any);
        expect(macReport.caddy).toMatchObject({ automaticFix: { key: SetupAutomaticFixKey.Caddy, label: 'Install Caddy with Homebrew' } });

        setPlatform('linux');
        mockSetupCommands({
            dns: 'Global: 127.0.0.1:1053\n',
            domains: 'Global: ~stamhoofd\n',
            caddyMissing: true,
        });

        const linuxReport = await checkSetup({ verbose: false } as any);
        expect(linuxReport.caddy.automaticFix).toBeUndefined();
    });

    it('installs Caddy through Homebrew on macOS', async () => {
        setPlatform('darwin');
        mockSetupCommands({ resolver: 'nameserver 127.0.0.1\n' });

        await setupCaddy({ yes: true, dryRun: false, verbose: true });

        expect(run).toHaveBeenCalledWith('brew', ['install', 'caddy'], { verbose: true });
    });

    it('prints the setup report with standardized status labels', () => {
        const messages: string[] = [];
        const original = console.log;
        console.log = (message?: unknown) => {
            messages.push(typeof message === 'string' ? message : '');
        };

        try {
            printSetupReport(setupReport({ caddy: { ok: true, details: '127.0.0.1:4080, 127.0.0.1:4443, admin 127.0.0.1:2021' } }));
        }
        finally {
            console.log = original;
        }

        expect(messages.join('\n')).toContain('Checking Stamhoofd local development setup');
        expect(messages.join('\n')).toContain('Podman / Docker');
        expect(messages.join('\n')).toContain('ready');
        expect(messages.join('\n')).toContain('127.0.0.1:4080, 127.0.0.1:4443, admin 127.0.0.1:2021');
    });
});


function setupReport(overrides: Partial<SetupReport>): SetupReport {
    return {
        node: ok(),
        docker: ok(),
        privilegedPorts: ok(),
        caddy: ok(),
        dns: ok(),
        cert: ok(),
        ...overrides,
    };
}

function ok(): CheckResult {
    return { ok: true, details: 'ok' };
}

function missingManual(details: string): CheckResult {
    return { ok: false, details, manualFix: 'manual fix' };
}

function missingAutomatic(key: SetupAutomaticFixKey, label: string): CheckResult {
    return { ok: false, details: 'missing', manualFix: `stam setup ${key}`, automaticFix: { key, label } };
}

function mockSetupCommands(options: { dns?: string; domains?: string; query?: string; resolver?: string; missingRedirects?: boolean; caddyMissing?: boolean }): void {
    vi.spyOn(fs, 'readFile').mockImplementation(async (filePath) => {
        if (filePath === '/etc/resolver/stamhoofd') {
            if (options.resolver === undefined) {
                const error = new Error('missing') as NodeJS.ErrnoException;
                error.code = 'ENOENT';
                throw error;
            }
            return options.resolver;
        }
        const unexpectedPath = typeof filePath === 'string'
            ? filePath
            : Buffer.isBuffer(filePath)
                ? filePath.toString('utf8')
                : filePath instanceof URL
                    ? filePath.href
                    : '<file handle>';
        throw new Error(`Unexpected readFile: ${unexpectedPath}`);
    });
    vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined as any);
    vi.spyOn(fs, 'rm').mockResolvedValue(undefined as any);

    vi.mocked(run).mockImplementation(async (command, args) => {
        if (command === 'caddy' && args[0] === 'version') {
            return options.caddyMissing
                ? { stdout: '', stderr: 'missing', status: 1 }
                : { stdout: 'v2.10.2\n', stderr: '', status: 0 };
        }
        if (command === 'resolvectl' && args[0] === 'dns') {
            return { stdout: options.dns ?? '', stderr: '', status: 0 };
        }
        if (command === 'resolvectl' && args[0] === 'domain') {
            return { stdout: options.domains ?? '', stderr: '', status: 0 };
        }
        if (command === 'resolvectl' && args[0] === 'query') {
            return { stdout: options.query ?? 'dashboard.stamhoofd: 127.0.0.1\n', stderr: '', status: 0 };
        }
        if (command === 'sudo' && args.includes('iptables') && args.includes('-C')) {
            return options.missingRedirects
                ? { stdout: '', stderr: 'missing', status: 1 }
                : { stdout: '', stderr: '', status: 0 };
        }
        if (command === 'sudo' || command === 'brew') {
            return { stdout: '', stderr: '', status: 0 };
        }

        throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    });
}

function setPlatform(platform: NodeJS.Platform): void {
    Object.defineProperty(process, 'platform', {
        value: platform,
        configurable: true,
    });
}
