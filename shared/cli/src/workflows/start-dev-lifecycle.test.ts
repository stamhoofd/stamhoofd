import { beforeEach, expect, it, vi } from 'vitest';
import { DevTarget, runDev } from './start-dev.js';
import { execResult } from '../runtime/process.js';
import { removeInstanceManifest } from '../runtime/manifest-store.js';
import { startServices, stopServices } from '../services/manager.js';
import { sharedServicesRunning } from '../services/shared-services.js';
import { CaddyService } from '../services/definitions/caddy-service.js';
import type { CliContext } from '../context/create-context.js';

vi.mock('../runtime/process.js', () => ({ execResult: vi.fn(async () => ({ code: 0, stdout: '', stderr: '', signal: null })) }));
vi.mock('../config/build-config.js', () => ({ buildBackendEnv: () => ({}), buildDomains: () => ({ docs: 'docs.stamhoofd', dashboard: 'dashboard.stamhoofd', api: 'api.stamhoofd' }) }));
vi.mock('../context/ports.js', () => ({ buildPorts: () => ({ docs: 3000 }) }));
vi.mock('../runtime/manifest-store.js', () => ({ writeInstanceManifest: vi.fn(), removeInstanceManifest: vi.fn() }));
vi.mock('../services/definitions/caddy-service.js', () => ({ CaddyService: { buildRouteOptions: () => ({}), reload: vi.fn() } }));
vi.mock('../services/registry.js', () => ({ sharedServiceDefinitions: [] }));
vi.mock('../services/manager.js', () => ({ startServices: vi.fn(async () => ({ started: [] })), stopServices: vi.fn() }));
vi.mock('../services/shared-services.js', () => ({ sharedServicesRunning: vi.fn(async () => true) }));
vi.mock('../services/stripe.js', () => ({ startStripe: vi.fn(), stopStripe: vi.fn() }));
vi.mock('./setup-machine.js', () => ({ checkSetup: async () => ({}), isSetupReady: () => true, printSetupReport: vi.fn() }));
vi.mock('../runtime/live-output.js', () => ({ createLiveOutput: () => ({ setStatus: vi.fn(), stop: vi.fn(), log: vi.fn() }) }));

const context = { rootDir: '/repo', env: 'stamhoofd' } as CliContext;
beforeEach(() => vi.clearAllMocks());

it('treats cancellation as a normal session stop and removes its manifest before reloading routes', async () => {
    vi.mocked(execResult).mockResolvedValueOnce({ code: 130, reason: 'aborted', stdout: '', stderr: '', signal: 'SIGTERM' });
    await runDev(context, DevTarget.Docs, { services: true, stripe: false });
    expect(execResult).toHaveBeenCalledWith('pnpm', expect.any(Array), expect.objectContaining({ label: false, output: 'always', outputStyle: 'plain', processGroup: true, maxDiagnosticChars: Number.MAX_SAFE_INTEGER }));
    expect(removeInstanceManifest).toHaveBeenCalledOnce();
    expect(vi.mocked(removeInstanceManifest).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(CaddyService.reload).mock.invocationCallOrder[1]);
    expect(stopServices).not.toHaveBeenCalled();
});

it('cleans up owned services and manifests when process startup fails', async () => {
    vi.mocked(sharedServicesRunning).mockResolvedValueOnce(false);
    vi.mocked(startServices).mockResolvedValueOnce({ env: {}, started: [{}] } as never);
    vi.mocked(execResult).mockRejectedValueOnce(new Error('spawn failed'));
    await expect(runDev(context, DevTarget.Docs, { services: true, stripe: false })).rejects.toThrow('spawn failed');
    expect(removeInstanceManifest).toHaveBeenCalledOnce();
    expect(stopServices).toHaveBeenCalledOnce();
});

it('reports unexpected process failure after cleanup', async () => {
    vi.mocked(execResult).mockResolvedValueOnce({ code: 3, stdout: '', stderr: 'application failed', signal: null });
    await expect(runDev(context, DevTarget.Docs, { services: false, stripe: false })).rejects.toThrow('application failed');
    expect(removeInstanceManifest).toHaveBeenCalledOnce();
    expect(CaddyService.reload).not.toHaveBeenCalled();
});
