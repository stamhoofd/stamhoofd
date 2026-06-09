import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { caddyDataDir } from '../config/shared-service-config.js';
import { CaddyService } from '../services/definitions/caddy-service.js';
import * as docker from '../services/docker.js';
import { startSharedServices } from '../services/shared-services.js';
import { run } from './command-runner.js';
import { testE2e } from './monorepo-runner.js';

vi.mock('./command-runner.js', () => ({
    run: vi.fn(async () => undefined),
}));

vi.mock('../services/docker.js', () => ({
    containerIsRunning: vi.fn(async () => true),
    waitForMysql: vi.fn(async () => undefined),
    run: vi.fn(async (args: string[]) => {
        if (args[0] === 'port') {
            return { stdout: '127.0.0.1:55103\n', stderr: '', status: 0 };
        }
        return { stdout: '', stderr: '', status: 0 };
    }),
}));

vi.mock('../services/shared-services.js', () => ({
    startSharedServices: vi.fn(async () => undefined),
}));

vi.mock('../services/definitions/caddy-service.js', () => ({
    CaddyService: {
        reload: vi.fn(async () => undefined),
    },
}));

describe('monorepo runner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('passes the Caddy root CA to Playwright', async () => {
        await testE2e(context(), { ci: false, clear: false, ui: false, workers: 2 });

        expect(docker.containerIsRunning).toHaveBeenCalledWith('stamhoofd-e2e-mysql');
        expect(startSharedServices).toHaveBeenCalledWith(context());
        expect(CaddyService.reload).toHaveBeenCalledWith(context());

        const playwrightRun = vi.mocked(run).mock.calls.find(([command, args]) => command === 'yarn' && args.includes('tests/playwright'));
        expect(playwrightRun).toBeDefined();
        expect(playwrightRun?.[2].env).toMatchObject({
            DB_PORT: '55103',
            NODE_EXTRA_CA_CERTS: path.join(caddyDataDir(), 'pki/authorities/local/root.crt'),
        });
    });

    it('passes Playwright test filters', async () => {
        await testE2e(context(), { ci: false, clear: false, grep: 'SGV OAuth login', tests: ['sgv-sync-organization.spec.ts'], ui: false, workers: 1 });

        const playwrightRun = vi.mocked(run).mock.calls.find(([command, args]) => command === 'yarn' && args.includes('tests/playwright'));
        expect(playwrightRun?.[1]).toEqual(expect.arrayContaining(['sgv-sync-organization.spec.ts', '--grep', 'SGV OAuth login', '--workers', '1']));
    });
});

function context() {
    return {
        rootDir: '/repo',
        generatedDir: '/repo/.development/cli/generated',
        env: 'stamhoofd',
        workspace: 'main',
        verbose: false,
        instance: {
            name: 'main',
            prefix: '',
            primary: true,
            portOffset: 0,
        },
    };
}
