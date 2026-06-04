import { beforeEach, describe, expect, it, vi } from 'vitest';
import Setup, { SetupAction } from './index.js';
import { runSetup, setupCert, setupDns } from '../../workflows/setup-machine.js';

vi.mock('../../workflows/setup-machine.js', () => ({
    runSetup: vi.fn(),
    setupCert: vi.fn(),
    setupDns: vi.fn(),
}));

describe('Setup command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('runs the full setup flow without an action', async () => {
        const command = createCommand({
            args: { action: undefined },
            flags: { yes: false, 'dry-run': false, verbose: false },
        });

        await command.run();

        expect(runSetup).toHaveBeenCalledWith({ context: 'setup', verbose: false });
        expect(setupDns).not.toHaveBeenCalled();
        expect(setupCert).not.toHaveBeenCalled();
    });

    it('runs dns setup directly', async () => {
        const command = createCommand({
            args: { action: SetupAction.Dns },
            flags: { yes: true, 'dry-run': true, verbose: true },
        });

        await command.run();

        expect(setupDns).toHaveBeenCalledWith({ yes: true, dryRun: true, verbose: true });
        expect(runSetup).not.toHaveBeenCalled();
    });

    it('runs cert setup directly', async () => {
        const command = createCommand({
            args: { action: SetupAction.Cert },
            flags: { yes: true, 'dry-run': true, verbose: false },
        });

        await command.run();

        expect(setupCert).toHaveBeenCalledWith({ context: 'setup', verbose: false }, { yes: true, dryRun: true });
        expect(runSetup).not.toHaveBeenCalled();
    });
});

function createCommand(parseResult: { args: { action: SetupAction | undefined }; flags: { yes: boolean; 'dry-run': boolean; verbose: boolean } }): Setup {
    const command = new Setup([], {} as any);
    (command as any).config = {};
    (command as any).parse = vi.fn(async () => parseResult);
    (command as any).createContext = vi.fn(async (flags: { verbose?: boolean }) => ({ context: 'setup', verbose: flags.verbose ?? false }));
    return command;
}
