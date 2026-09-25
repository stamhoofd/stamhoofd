import { Parser } from '@oclif/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckFormat from './format.js';
import { createContext } from '../../context/create-context.js';
import { run, RunVerbosity } from '../../runtime/command-runner.js';

vi.mock('../../context/create-context.js', () => ({ createContext: vi.fn(async () => ({ rootDir: '/repo' })) }));
vi.mock('../../runtime/command-runner.js', async importOriginal => ({
    ...await importOriginal<typeof import('../../runtime/command-runner.js')>(),
    run: vi.fn(),
}));

describe('check format', () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([
        [[], '--check'],
        [['--fix'], '--write'],
    ])('runs oxfmt for %j', async (args, mode) => {
        const command = new CheckFormat([], {} as never);
        (command as any).parse = vi.fn(async () => await Parser.parse(args, { flags: CheckFormat.flags }));

        await command.run();

        expect(createContext).toHaveBeenCalledWith({ env: 'stamhoofd', instanceName: undefined, verbose: false });
        expect(run).toHaveBeenCalledWith('pnpm', ['exec', 'oxfmt', mode], { cwd: '/repo', verbosity: RunVerbosity.Output });
    });
});
