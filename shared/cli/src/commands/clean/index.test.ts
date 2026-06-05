import { beforeEach, describe, expect, it, vi } from 'vitest';
import Clean, { CleanTarget } from './index.js';
import { cleanBuild } from '../../runtime/monorepo-runner.js';
import { showHelp } from '../../runtime/show-help.js';
import { confirm, warning } from '../../runtime/ux.js';
import { run } from '../../runtime/command-runner.js';
import { ssoService } from '../../services/definitions/sso-service.js';
import { deleteSharedServicesData, stopSharedServices } from '../../services/shared-services.js';

vi.mock('../../runtime/monorepo-runner.js', () => ({
    cleanBuild: vi.fn(),
}));

vi.mock('../../runtime/show-help.js', () => ({
    showHelp: vi.fn(),
}));

vi.mock('../../runtime/ux.js', () => ({
    confirm: vi.fn(),
    warning: vi.fn(),
}));

vi.mock('../../runtime/command-runner.js', () => ({
    run: vi.fn(),
}));

vi.mock('../../services/definitions/sso-service.js', () => ({
    ssoService: {
        stop: vi.fn(),
    },
}));

vi.mock('../../services/shared-services.js', () => ({
    deleteSharedServicesData: vi.fn(),
    stopSharedServices: vi.fn(),
}));

describe('Clean command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(confirm).mockResolvedValue(true);
    });

    it('shows help when no target is provided', async () => {
        const command = createCommand({
            args: { target: undefined },
            flags: { yes: false, 'dry-run': false, verbose: false },
        });

        await command.run();

        expect(showHelp).toHaveBeenCalledWith(command.config, ['clean']);
        expect(cleanBuild).not.toHaveBeenCalled();
    });

    it('runs build cleanup directly', async () => {
        const command = createCommand({
            args: { target: CleanTarget.Build },
            flags: { yes: false, 'dry-run': true, verbose: false },
        });

        await command.run();

        expect(cleanBuild).toHaveBeenCalledWith(expect.objectContaining({ context: 'clean' }), { dryRun: true });
    });

    it('stops services and deletes service data', async () => {
        const command = createCommand({
            args: { target: CleanTarget.Services },
            flags: { yes: true, 'dry-run': false, verbose: false },
        });

        await command.run();

        expect(stopSharedServices).toHaveBeenCalledWith(expect.objectContaining({ context: 'clean' }));
        expect(deleteSharedServicesData).toHaveBeenCalledWith(expect.objectContaining({ context: 'clean' }));
    });

    it('prints dry-run actions for all without running destructive work', async () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const command = createCommand({
            args: { target: CleanTarget.All },
            flags: { yes: false, 'dry-run': true, verbose: false },
        });

        await command.run();

        expect(cleanBuild).toHaveBeenCalledWith(expect.objectContaining({ context: 'clean' }), { dryRun: true });
        expect(run).not.toHaveBeenCalled();
        expect(stopSharedServices).not.toHaveBeenCalled();
        expect(deleteSharedServicesData).not.toHaveBeenCalled();
        expect(ssoService.stop).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalled();
        log.mockRestore();
    });

    it('skips destructive services clean when confirmation is denied', async () => {
        vi.mocked(confirm).mockResolvedValue(false);
        const command = createCommand({
            args: { target: CleanTarget.Services },
            flags: { yes: false, 'dry-run': false, verbose: false },
        });

        await command.run();

        expect(stopSharedServices).not.toHaveBeenCalled();
        expect(deleteSharedServicesData).not.toHaveBeenCalled();
        expect(warning).toHaveBeenCalledWith('Clean skipped.');
    });

    it('rejects env for targets that do not use it', async () => {
        const command = createCommand({
            args: { target: CleanTarget.Build },
            flags: { yes: false, 'dry-run': false, verbose: false, env: 'keeo' },
        });
        (command as any).error = vi.fn((message: string) => {
            throw new Error(message);
        });

        await expect(command.run()).rejects.toThrow("--env only applies to 'clean db' and 'clean all'.");
    });

    it('rejects name for targets that do not use it', async () => {
        const command = createCommand({
            args: { target: CleanTarget.Services },
            flags: { yes: false, 'dry-run': false, verbose: false, name: 'feature-payments' },
        });
        (command as any).error = vi.fn((message: string) => {
            throw new Error(message);
        });

        await expect(command.run()).rejects.toThrow("--name only applies to 'clean db' and 'clean all'.");
    });
});

function createCommand(parseResult: { args: { target: CleanTarget | undefined }; flags: { yes: boolean; 'dry-run': boolean; verbose: boolean; env?: string; name?: string } }): Clean {
    const command = new Clean([], {} as any);
    (command as any).config = {};
    (command as any).parse = vi.fn(async () => parseResult);
    (command as any).createContext = vi.fn(async () => ({
        context: 'clean',
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
    return command;
}
