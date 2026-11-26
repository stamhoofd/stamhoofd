import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Parser } from '@oclif/core';
import Dev from './index.js';
import { DevTarget, runDev } from '../../workflows/start-dev.js';
import { showHelp } from '../../runtime/show-help.js';
import { checkNodeVersion, printNodeVersionStatus } from '../../workflows/setup-node.js';

vi.mock('../../workflows/start-dev.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../workflows/start-dev.js')>()),
    runDev: vi.fn(),
}));

vi.mock('../../runtime/show-help.js', () => ({
    showHelp: vi.fn(),
}));

vi.mock('../../workflows/setup-node.js', () => ({
    checkNodeVersion: vi.fn(),
    printNodeVersionStatus: vi.fn(),
}));

describe('Dev command', () => {
    afterEach(() => vi.unstubAllEnvs());

    beforeEach(() => {
        vi.stubEnv('STAM_DEV_CAPTURE', undefined);
        vi.clearAllMocks();
        vi.mocked(checkNodeVersion).mockResolvedValue({
            ok: true,
            current: 'v22.22.3',
            expected: 'v22.22.3',
            details: 'v22.22.3 matches .nvmrc',
        });
    });

    it('shows help when no target is provided', async () => {
        const command = createCommand({
            args: { target: undefined },
            flags: { services: undefined, stripe: false, open: false },
        });

        await command.run();

        expect(showHelp).toHaveBeenCalledWith(command.config, ['dev']);
        expect(runDev).not.toHaveBeenCalled();
    });

    it('parses compact detail by default, independent of subprocess verbosity, and rejects obsolete flags', async () => {
        const parse = (args: string[]) => Parser.parse(args, { flags: Dev.flags });
        for (const args of [
            [],
            ['--trace-detail', 'full'],
            ['--trace-detail', 'compact'],
            ['--quiet'],
        ]) {
            const { flags } = await parse(args);
            expect(flags['trace-detail']).toBe(args.includes('full') ? 'full' : 'compact');
            expect(flags.verbose).toBe(false);
        }
        await expect(parse(['--trace', 'GET /health'])).rejects.toThrow();
        await expect(parse(['--trace-detail', 'other'])).rejects.toThrow();
    });

    it('defaults services to false for the frontend target', async () => {
        const command = createCommand({
            args: { target: DevTarget.Frontend },
            flags: { services: undefined, stripe: false, open: false },
        });

        await command.run();

        expect(runDev).toHaveBeenCalledWith({ context: 'dev' }, DevTarget.Frontend, {
            services: false,
            stripe: false,
            open: false,
        });
    });

    it('defaults services to true for the docs target', async () => {
        const command = createCommand({
            args: { target: DevTarget.Docs },
            flags: { services: undefined, stripe: false, open: false },
        });

        await command.run();

        expect(runDev).toHaveBeenCalledWith({ context: 'dev' }, DevTarget.Docs, {
            services: true,
            stripe: false,
            open: false,
        });
    });

    it('passes explicit flags through to backend runs', async () => {
        vi.stubEnv('STAM_DEV_CAPTURE', 'GET /health');
        const command = createCommand({
            args: { target: DevTarget.Backend },
            flags: {
                services: false,
                stripe: true,
                open: true,
                'trace-detail': 'compact',
                'trace-filter': 'PATCH /invoices',
            },
        });

        await command.run();

        expect(runDev).toHaveBeenCalledWith({ context: 'dev' }, DevTarget.Backend, {
            services: false,
            stripe: true,
            open: true,
            traceDetail: 'compact',
            traceFilter: 'PATCH /invoices',
        });
    });

    it.each(['GET /invoices', 'statistics.cycle', '*'])(
        'accepts %s from the environment',
        async (trace) => {
            vi.stubEnv('STAM_DEV_CAPTURE', trace);
            const command = createCommand({
                args: { target: DevTarget.All },
                flags: { services: false, stripe: false, open: false },
            });
            await command.run();
            expect(runDev).toHaveBeenCalledWith(
                { context: 'dev' },
                DevTarget.All,
                expect.objectContaining({ traceFilter: trace }),
            );
        },
    );

    it.each(['flag', 'environment'])(
        'rejects unsupported selectors from %s with the choices shown in help',
        async (source) => {
            const invalid = 'DELETE /invoices';
            if (source === 'environment') vi.stubEnv('STAM_DEV_CAPTURE', invalid);
            const command = createCommand({
                args: { target: DevTarget.Backend },
                flags: {
                    services: false,
                    stripe: false,
                    open: false,
                    'trace-filter': source === 'flag' ? invalid : undefined,
                },
            });
            const choices = '*, PATCH /invoices, GET /invoices, GET /health, statistics.cycle';
            expect(Dev.flags['trace-filter'].description).toContain(choices);
            await expect(command.run()).rejects.toThrow(choices);
            expect(runDev).not.toHaveBeenCalled();
        },
    );

    it('rejects an environment selector before docs setup', async () => {
        vi.stubEnv('STAM_DEV_CAPTURE', 'GET /health');
        const command = createCommand({
            args: { target: DevTarget.Docs },
            flags: { services: false, stripe: false, open: false },
        });
        await expect(command.run()).rejects.toThrow(
            '--trace-filter requires the all, instance, or backend target.',
        );
        expect(runDev).not.toHaveBeenCalled();
    });

    it('rejects request capture on targets without the API', async () => {
        const command = createCommand({
            args: { target: DevTarget.Frontend },
            flags: {
                services: false,
                stripe: false,
                open: false,
                'trace-filter': 'PATCH /invoices',
            },
        });
        await expect(command.run()).rejects.toThrow(
            '--trace-filter requires the all, instance, or backend target.',
        );
        expect(runDev).not.toHaveBeenCalled();
    });

    it('stops before creating a development context when Node.js is wrong', async () => {
        vi.mocked(checkNodeVersion).mockResolvedValue({
            ok: false,
            current: 'v22.21.1',
            expected: 'v22.22.3',
            details: 'v22.21.1 is active, but .nvmrc requires v22.22.3',
        });
        const command = createCommand({
            args: { target: DevTarget.All },
            flags: { services: undefined, stripe: false, open: false },
        });

        await command.run();

        expect(printNodeVersionStatus).toHaveBeenCalled();
        expect((command as any).createContext).not.toHaveBeenCalled();
        expect(runDev).not.toHaveBeenCalled();
    });
});

function createCommand(parseResult: {
    args: { target: DevTarget | undefined };
    flags: {
        services: boolean | undefined;
        stripe: boolean;
        open: boolean;
        'trace-filter'?: string;
        'trace-detail'?: string;
    };
}): Dev {
    const command = new Dev([], {} as any);
    (command as any).config = {};
    (command as any).parse = vi.fn(async () => parseResult);
    (command as any).createContext = vi.fn(async () => ({ context: 'dev' }));
    return command;
}
