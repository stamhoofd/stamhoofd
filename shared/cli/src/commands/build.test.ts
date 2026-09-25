import { Parser } from '@oclif/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Build from './build.js';
import { buildAll } from '../runtime/monorepo-runner.js';
import { RunVerbosity } from '../runtime/command-runner.js';
import { createContext } from '../context/create-context.js';

vi.mock('../runtime/monorepo-runner.js', () => ({ buildAll: vi.fn() }));
vi.mock('../context/create-context.js', () => ({ createContext: vi.fn(async () => ({ rootDir: '/repo' })) }));

describe('build command verbosity', () => {
    beforeEach(() => vi.clearAllMocks());

    it('only offers a quiet modifier', async () => {
        await expect(Parser.parse(['--quiet'], { flags: Build.flags })).resolves.toMatchObject({ flags: { quiet: true } });
        await expect(Parser.parse(['-v'], { flags: Build.flags })).rejects.toThrow();
    });

    it.each([
        [false, RunVerbosity.Output],
        [true, RunVerbosity.Command],
    ])('resolves quiet=%s to %s', async (quiet, verbosity) => {
        const command = new Build([], {} as never);
        (command as any).parse = vi.fn(async () => ({ flags: { quiet }, raw: [] }));

        await command.run();

        expect(createContext).toHaveBeenCalledWith({ env: 'stamhoofd', instanceName: undefined, verbose: false });
        expect(buildAll).toHaveBeenCalledWith({ rootDir: '/repo', verbosity });
    });
});
