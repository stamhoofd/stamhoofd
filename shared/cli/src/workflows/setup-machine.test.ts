import { beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from '../runtime/command-runner.js';
import { confirm } from '../runtime/ux.js';
import { corednsService } from '../services/definitions/coredns-service.js';
import * as docker from '../services/docker.js';
import { checkSetup, getRecommendedSetupFixes, isSetupReady, printSetupReport, runSetup } from './setup-machine.js';
import type { CheckResult, SetupReport } from './setup-machine.js';

vi.mock('../runtime/command-runner.js', () => ({
    run: vi.fn(),
}));

vi.mock('../services/definitions/coredns-service.js', () => ({
    corednsService: { status: vi.fn() },
}));

vi.mock('../services/docker.js', () => ({
    getContainerRuntime: vi.fn(),
    containerIsRunning: vi.fn(),
}));

vi.mock('../runtime/ux.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('../runtime/ux.js')>(),
    confirm: vi.fn(),
}));

describe('setup machine workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(docker.getContainerRuntime).mockResolvedValue('docker');
        vi.mocked(docker.containerIsRunning).mockResolvedValue(false);
    });

    it('recommends automatic fixes while prerequisites are available', () => {
        const report = setupReport({
            dns: missingAutomatic('dns', 'Configure local DNS'),
            cert: missingAutomatic('cert', 'Trust local HTTPS certificates'),
        });

        expect(getRecommendedSetupFixes(report)).toEqual([
            { key: 'dns', label: 'Configure local DNS' },
            { key: 'cert', label: 'Trust local HTTPS certificates' },
        ]);
    });

    it('does not recommend automatic fixes after a missing manual prerequisite', () => {
        const report = setupReport({
            caddy: missingManual('caddy not found'),
            dns: missingAutomatic('dns', 'Configure local DNS'),
            cert: missingAutomatic('cert', 'Trust local HTTPS certificates'),
        });

        expect(getRecommendedSetupFixes(report)).toEqual([]);
    });

    it('keeps earlier automatic fixes but stops at the first manual blocker', () => {
        const report = setupReport({
            dns: missingAutomatic('dns', 'Configure local DNS'),
            cert: missingManual('Caddy local CA not found'),
        });

        expect(getRecommendedSetupFixes(report)).toEqual([
            { key: 'dns', label: 'Configure local DNS' },
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
            automaticFix: { key: 'dns', label: 'Configure local DNS' },
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
            automaticFix: { key: 'services', label: 'Start shared services' },
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

    it('skips Podman port redirect checks for Docker', async () => {
        mockSetupCommands({
            dns: 'Global: 127.0.0.1:1053\n',
            domains: 'Global: ~stamhoofd\n',
        });

        const report = await checkSetup({ verbose: false } as any);

        expect(report.podmanPorts).toEqual({ ok: true, details: 'not needed for docker' });
    });

    it('recommends Podman port redirects when iptables rules are missing', async () => {
        vi.mocked(docker.getContainerRuntime).mockResolvedValue('podman');
        mockSetupCommands({
            dns: 'Global: 127.0.0.1:1053\n',
            domains: 'Global: ~stamhoofd\n',
        });

        const report = await checkSetup({ verbose: false } as any);

        expect(report.podmanPorts).toMatchObject({
            ok: false,
            automaticFix: { key: 'podman-ports', label: 'Configure Podman port redirects' },
        });
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
        docker: ok(),
        podmanPorts: ok(),
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

function missingAutomatic(key: 'dns' | 'podman-ports' | 'services' | 'cert', label: string): CheckResult {
    return { ok: false, details: 'missing', manualFix: `stam setup ${key}`, automaticFix: { key, label } };
}

function mockSetupCommands(options: { dns: string; domains: string; query?: string }): void {
    vi.mocked(run).mockImplementation(async (command, args) => {
        if (command === 'caddy' && args[0] === 'version') {
            return { stdout: 'v2.10.2\n', stderr: '', status: 0 };
        }
        if (command === 'resolvectl' && args[0] === 'dns') {
            return { stdout: options.dns, stderr: '', status: 0 };
        }
        if (command === 'resolvectl' && args[0] === 'domain') {
            return { stdout: options.domains, stderr: '', status: 0 };
        }
        if (command === 'resolvectl' && args[0] === 'query') {
            return { stdout: options.query ?? 'dashboard.stamhoofd: 127.0.0.1\n', stderr: '', status: 0 };
        }
        if (command === 'sudo' && args.includes('iptables') && args.includes('-C')) {
            return { stdout: '', stderr: 'missing', status: 1 };
        }

        throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    });
}
