import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dev from './index.js';
import { DevTarget, runDev } from '../../workflows/start-dev.js';
import { showHelp } from '../../runtime/show-help.js';

vi.mock('../../workflows/start-dev.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../workflows/start-dev.js')>(),
    runDev: vi.fn(),
}));

vi.mock('../../runtime/show-help.js', () => ({
    showHelp: vi.fn(),
}));

describe('Dev command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
});

function createCommand(parseResult: { args: { target: DevTarget | undefined }; flags: { services: boolean | undefined; stripe: boolean; open: boolean } }): Dev {
    const command = new Dev([], {} as any);
    (command as any).config = {};
    (command as any).parse = vi.fn(async () => parseResult);
    (command as any).createContext = vi.fn(async () => ({ context: 'dev' }));
    return command;
}
