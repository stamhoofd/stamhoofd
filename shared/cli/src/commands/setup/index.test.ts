import { beforeEach, describe, expect, it, vi } from 'vitest';
import Setup, { SetupAction } from './index.js';
import { confirm } from '../../runtime/ux.js';
import { runSetup, setupCert, setupDns } from '../../workflows/setup-machine.js';
import { checkNodeVersion, printNodeVersionStatus, setupNodeVersion } from '../../workflows/setup-node.js';
import { setupShellShortcut } from '../../workflows/setup-shell.js';

vi.mock('../../workflows/setup-machine.js', () => ({
    runSetup: vi.fn(),
    setupCert: vi.fn(),
    setupDns: vi.fn(),
}));

vi.mock('../../workflows/setup-shell.js', () => ({
    setupShellShortcut: vi.fn(),
}));

vi.mock('../../workflows/setup-node.js', () => ({
    checkNodeVersion: vi.fn(),
    printNodeVersionStatus: vi.fn(),
    setupNodeVersion: vi.fn(),
}));

vi.mock('../../runtime/ux.js', () => ({
    confirm: vi.fn(),
}));

describe('Setup command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(checkNodeVersion).mockResolvedValue({
            ok: true,
            current: 'v22.22.3',
            expected: 'v22.22.3',
            details: 'v22.22.3 matches .nvmrc',
        });
    });

    it('runs the full setup flow without an action', async () => {
        const command = createCommand({
            args: { action: undefined },
            flags: { yes: false, 'dry-run': false, verbose: false },
        });

        await command.run();

        expect(runSetup).toHaveBeenCalledWith({ context: 'setup', rootDir: '/repo', verbose: false });
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

        expect(setupCert).toHaveBeenCalledWith({ context: 'setup', rootDir: '/repo', verbose: false }, { yes: true, dryRun: true });
        expect(runSetup).not.toHaveBeenCalled();
    });

    it('installs the shell shortcut directly', async () => {
        const command = createCommand({
            args: { action: SetupAction.Shell },
            flags: { yes: false, 'dry-run': true, verbose: false },
        });

        await command.run();

        expect(setupShellShortcut).toHaveBeenCalledWith({ dryRun: true });
        expect(runSetup).not.toHaveBeenCalled();
    });

    it('installs the configured Node.js version directly', async () => {
        const command = createCommand({
            args: { action: SetupAction.Node },
            flags: { yes: false, 'dry-run': false, verbose: true },
        });

        await command.run();

        expect(setupNodeVersion).toHaveBeenCalledWith(expect.any(String), { verbose: true, dryRun: false });
        expect(runSetup).not.toHaveBeenCalled();
    });

    it('offers to install Node.js before creating the full setup context', async () => {
        vi.mocked(checkNodeVersion).mockResolvedValue({
            ok: false,
            current: 'v22.21.1',
            expected: 'v22.22.3',
            details: 'v22.21.1 is active, but .nvmrc requires v22.22.3',
        });
        vi.mocked(confirm).mockResolvedValue(true);
        const command = createCommand({
            args: { action: undefined },
            flags: { yes: false, 'dry-run': false, verbose: true },
        });

        await command.run();

        expect(printNodeVersionStatus).toHaveBeenCalled();
        expect(confirm).toHaveBeenCalledWith('Install Node.js v22.22.3 now?', { default: true });
        expect(setupNodeVersion).toHaveBeenCalledWith(expect.any(String), { verbose: true });
        expect((command as any).createContext).not.toHaveBeenCalled();
        expect(runSetup).not.toHaveBeenCalled();
    });
});

function createCommand(parseResult: { args: { action: SetupAction | undefined }; flags: { yes: boolean; 'dry-run': boolean; verbose: boolean } }): Setup {
    const command = new Setup([], {} as any);
    (command as any).config = {};
    (command as any).parse = vi.fn(async () => parseResult);
    (command as any).createContext = vi.fn(async (flags: { verbose?: boolean }) => ({ context: 'setup', rootDir: '/repo', verbose: flags.verbose ?? false }));
    return command;
}
