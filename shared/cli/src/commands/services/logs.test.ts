import { beforeEach, describe, expect, it, vi } from 'vitest';
import ServicesLogs from './logs.js';
import { tailSharedLogs } from '../../services/shared-services.js';

vi.mock('../../services/shared-services.js', () => ({
    tailSharedLogs: vi.fn(),
}));

describe('ServicesLogs command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('tails shared logs without creating a context', async () => {
        const command = new ServicesLogs([], {} as any);
        (command as any).config = {};
        (command as any).parse = vi.fn(async () => ({ flags: { verbose: true } }));

        await command.run();

        expect(tailSharedLogs).toHaveBeenCalledTimes(1);
    });
});
