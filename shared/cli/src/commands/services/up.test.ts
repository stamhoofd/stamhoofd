import { Parser } from '@oclif/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ServicesUp from './up.js';
import { runServices } from '../../workflows/start-services.js';
import { RunVerbosity } from '../../runtime/command-runner.js';
import { createContext } from '../../context/create-context.js';

vi.mock('../../workflows/start-services.js', () => ({ runServices: vi.fn() }));
vi.mock('../../context/create-context.js', () => ({ createContext: vi.fn(async () => ({ rootDir: '/repo' })) }));

describe('services up verbosity', () => {
    beforeEach(() => vi.clearAllMocks());

    it('does not offer a quiet modifier', async () => {
        await expect(Parser.parse(['--quiet'], { flags: ServicesUp.flags })).rejects.toThrow();
    });

    it.each([
        [[], RunVerbosity.Quiet],
        [['-v'], RunVerbosity.Command],
        [['-vv'], RunVerbosity.Output],
        [['-v', '-v'], RunVerbosity.Output],
        [['-vvv'], RunVerbosity.Output],
    ])('resolves %j to %s', async (args, verbosity) => {
        const command = new ServicesUp([], {} as never);
        const parsed = await Parser.parse(args, { flags: ServicesUp.flags });
        (command as any).parse = vi.fn(async () => parsed);

        await command.run();

        expect(createContext).toHaveBeenCalledWith({ env: 'stamhoofd', instanceName: undefined, verbose: args.length > 0 });
        expect(runServices).toHaveBeenCalledWith({ rootDir: '/repo', verbosity });
    });
});
