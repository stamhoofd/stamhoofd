import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dev from './index.js';
import { DevTarget, runDev } from '../../workflows/start-dev.js';
import { showHelp } from '../../runtime/show-help.js';
import { checkNodeVersion, printNodeVersionStatus } from '../../workflows/setup-node.js';

vi.mock('../../workflows/start-dev.js', async importOriginal => ({
    ...await importOriginal<typeof import('../../workflows/start-dev.js')>(),
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
    beforeEach(() => {
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
        const command = createCommand({
            args: { target: DevTarget.Backend },
            flags: { services: false, stripe: true, open: true },
        });

        await command.run();

        expect(runDev).toHaveBeenCalledWith({ context: 'dev' }, DevTarget.Backend, {
            services: false,
            stripe: true,
            open: true,
        });
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

function createCommand(parseResult: { args: { target: DevTarget | undefined }; flags: { services: boolean | undefined; stripe: boolean; open: boolean } }): Dev {
    const command = new Dev([], {} as any);
    (command as any).config = {};
    (command as any).parse = vi.fn(async () => parseResult);
    (command as any).createContext = vi.fn(async () => ({ context: 'dev' }));
    return command;
}
