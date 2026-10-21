import { Parser } from '@oclif/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runUnitTests } from '../../runtime/monorepo-runner.js';
import Test from './index.js';

vi.mock('../../runtime/monorepo-runner.js', () => ({
    runUnitTests: vi.fn(),
    unitTestPackages: [{ name: 'api', path: 'backend/app/api', needsDatabase: true }],
    coverageTestPackages: [],
}));

describe('unit test options', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses the shard flag without treating it as a filename filter', async () => {
        const parsed = await Parser.parse(['api', '--shard', '1/2'], Test);

        expect(parsed.argv).toEqual(['api']);
        expect(parsed.flags).toMatchObject({ shard: '1/2' });
    });

    it.each([undefined, '1/1', '1/2', '2/2'])('forwards shard %s', async (shard) => {
        await createCommand(shard).run();

        expect(runUnitTests).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ shard }));
    });

    it('parses the report flag without treating it as a filename filter', async () => {
        const parsed = await Parser.parse(['api', '--json-report', '/reports/api.json'], Test);

        expect(parsed.argv).toEqual(['api']);
        expect(parsed.flags).toMatchObject({ 'json-report': '/reports/api.json' });
    });

    it('forwards the report path', async () => {
        const command = createCommand(undefined);
        (command as any).parse = vi.fn(async () => ({ argv: ['api'], flags: { 'json-report': '/reports/api.json' } }));
        await command.run();

        expect(runUnitTests).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ jsonReport: '/reports/api.json' }));
    });

    it.each(['', '0/2', '1/0', '3/2', '-1/2', '1.5/2', '1', '1/2/3', '1/2foo', ' 1/2', '01/2', '1/9007199254740992'])('rejects invalid shard %s before starting services', async (shard) => {
        await expect(createCommand(shard).run()).rejects.toThrow('--shard must be index/total');

        expect(runUnitTests).not.toHaveBeenCalled();
    });
});

function createCommand(shard: string | undefined): Test {
    const command = new Test([], {} as any);
    (command as any).parse = vi.fn(async () => ({ argv: ['api'], flags: { shard } }));
    (command as any).parseWithContext = vi.fn(async () => ({ context: { rootDir: '/repo' } }));
    return command;
}
