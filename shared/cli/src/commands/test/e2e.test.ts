import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testE2e } from '../../runtime/monorepo-runner.js';
import TestE2e from './e2e.js';

vi.mock('../../runtime/monorepo-runner.js', () => ({ testE2e: vi.fn() }));

describe('e2e shard selection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([undefined, '1/1', '1/4', '4/4'])('forwards shard %s and the worker count', async (shard) => {
        const command = createCommand(shard);

        await command.run();

        expect(testE2e).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ shard, workers: 2 }));
    });

    it.each(['', '0/4', '1/0', '5/4', '-1/4', '1.5/4', '1', '1/4/2', '1/4foo', ' 1/4', '01/4', '1/9007199254740992'])('rejects invalid shard %s before starting services', async (shard) => {
        await expect(createCommand(shard).run()).rejects.toThrow('--shard must be index/total');

        expect(testE2e).not.toHaveBeenCalled();
    });
});

function createCommand(shard: string | undefined): TestE2e {
    const command = new TestE2e([], {} as any);
    (command as any).parse = vi.fn(async () => ({ flags: { shard, workers: 2 } }));
    (command as any).parseWithContext = vi.fn(async () => ({ context: { rootDir: '/repo' } }));
    return command;
}
