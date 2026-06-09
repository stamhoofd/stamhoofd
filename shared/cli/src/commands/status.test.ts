import { beforeEach, describe, expect, it, vi } from 'vitest';
import Status from './status.js';
import { listActiveRouteManifests, RouteManifestKind } from '../runtime/manifest-store.js';
import { printSharedServicesStatus } from '../services/shared-services.js';
import { inspectDns } from '../workflows/dns-inspection.js';
import { inspectCaddy } from '../workflows/caddy-inspection.js';

vi.mock('../runtime/manifest-store.js', () => ({
    listActiveRouteManifests: vi.fn(async () => []),
    RouteManifestKind: {
        DevInstance: 'dev-instance',
    },
}));

vi.mock('../services/shared-services.js', () => ({
    printSharedServicesStatus: vi.fn(),
}));

vi.mock('../workflows/dns-inspection.js', () => ({
    inspectDns: vi.fn(async () => dnsInspection()),
}));

vi.mock('../workflows/caddy-inspection.js', () => ({
    inspectCaddy: vi.fn(async () => caddyInspection()),
}));

describe('Status command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates context with verbose only', async () => {
        const command = new Status([], {} as any);
        const createContext = vi.fn(async () => ({
            rootDir: '/repo',
            generatedDir: '/repo/.development/cli/generated',
            env: 'stamhoofd',
            workspace: 'main',
            verbose: true,
            instance: {
                name: 'stamhoofd',
                prefix: '',
                primary: true,
                portOffset: 0,
            },
        }));

        (command as any).config = {};
        (command as any).parse = vi.fn(async () => ({ flags: { current: false, export: false, watch: false, verbose: true } }));
        (command as any).createContext = createContext;

        await command.run();

        expect(createContext).toHaveBeenCalledWith({ verbose: true });
        expect(printSharedServicesStatus).toHaveBeenCalled();
        expect(inspectDns).toHaveBeenCalled();
        expect(inspectCaddy).toHaveBeenCalled();
        expect(listActiveRouteManifests).toHaveBeenCalled();
    });

    it('prints status export JSON and exits', async () => {
        const command = new Status([], {} as any);
        const log = vi.fn();
        const createContext = vi.fn(async () => ({
            rootDir: '/repo',
            generatedDir: '/repo/.development/cli/generated',
            env: 'stamhoofd',
            workspace: 'main',
            verbose: false,
            instance: {
                name: 'stamhoofd',
                prefix: '',
                primary: true,
                portOffset: 0,
            },
        }));

        (command as any).config = {};
        (command as any).log = log;
        (command as any).parse = vi.fn(async () => ({ flags: { current: false, export: true, watch: false, verbose: false } }));
        (command as any).createContext = createContext;

        await command.run();

        expect(printSharedServicesStatus).not.toHaveBeenCalled();
        expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ dns: { domain: 'stamhoofd' }, caddy: { liveReachable: true } });
    });
});

function dnsInspection() {
    return {
        domain: 'stamhoofd',
        query: 'dashboard.stamhoofd',
        profile: {
            platform: 'linux',
            runtime: 'docker',
            corednsHostPort: 1053,
            caddyHttpHostPort: 8080,
            caddyHttpsHostPort: 8443,
            caddyHttpListenPort: 8080,
            caddyHttpsListenPort: 8443,
            caddyAdminListenHost: '127.0.0.1',
            caddyProxyHost: '127.0.0.1',
            caddyListenHost: '127.0.0.1',
            caddyRunMode: 'host-network',
            needsPrivilegedRedirects: true,
            dnsSetupKind: 'systemd-resolved',
        },
        expected: {
            corefile: 'stamhoofd {\n    log\n}\n',
            records: [
                { zone: 'stamhoofd', type: 'A', value: '127.0.0.1', appliesTo: 'Every hostname under .stamhoofd' },
            ],
            osConfigPath: '/run/systemd/resolved.conf.d/stamhoofd.conf',
            osConfigContent: '[Resolve]\nDNS=127.0.0.1:1053\nDomains=~stamhoofd\n',
        },
        current: {
            osConfigContent: '[Resolve]\nDNS=127.0.0.1:1053\nDomains=~stamhoofd\n',
            osConfigMatches: true,
            corednsRunning: true,
            directCorednsAddresses: ['127.0.0.1'],
            systemResolverAddresses: ['127.0.0.1'],
        },
        checks: [
            { key: 'coredns', ok: true, label: 'CoreDNS service', details: 'stamhoofd-coredns is running' },
        ],
    };
}

function caddyInspection() {
    return {
        liveReachable: true,
        adminUrl: 'http://127.0.0.1:2019',
        routeGroups: [
            {
                label: 'Shared services',
                order: 10,
                routes: [
                    { hosts: ['mail.stamhoofd'], upstream: '127.0.0.1:1080', port: 1080, source: 'shared service', sourceOrder: 20, live: 'configured' },
                ],
            },
            {
                label: 'Current workspace - stamhoofd',
                order: 20,
                routes: [
                    { hosts: ['dashboard.stamhoofd'], upstream: '127.0.0.1:8080', port: 8080, source: 'dev instance', sourceOrder: 10, live: 'configured' },
                ],
            },
        ],
        subjects: [],
    };
}
