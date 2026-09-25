import { beforeEach, describe, expect, it, vi } from 'vitest';
import ServicesLogs from './logs.js';
import { tailSharedLogs } from '../../services/shared-services.js';
import { RunVerbosity } from '../../runtime/command-runner.js';

vi.mock('../../services/shared-services.js', () => ({
    tailSharedLogs: vi.fn(),
}));

describe('ServicesLogs command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('tails shared logs at the selected verbosity', async () => {
        const command = new ServicesLogs([], {} as any);
        (command as any).config = {};
        (command as any).parseWithContext = vi.fn(async () => ({ context: { verbosity: RunVerbosity.Command } }));

        await command.run();

        expect(tailSharedLogs).toHaveBeenCalledExactlyOnceWith(RunVerbosity.Command);
    });
});
