import { Parser } from '@oclif/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DocsMigrate from './migrate.js';
import { createContext } from '../../context/create-context.js';
import { run, RunVerbosity } from '../../runtime/command-runner.js';

vi.mock('../../context/create-context.js', () => ({ createContext: vi.fn(async () => ({ rootDir: '/repo' })) }));
vi.mock('../../runtime/command-runner.js', async importOriginal => ({
    ...await importOriginal<typeof import('../../runtime/command-runner.js')>(),
    run: vi.fn(),
}));

describe('docs migrate verbosity', () => {
    beforeEach(() => vi.clearAllMocks());

    async function command(args: string[]): Promise<DocsMigrate> {
        const result = new DocsMigrate([], {} as never);
        const parsed = await Parser.parse(args, { flags: DocsMigrate.flags, args: DocsMigrate.args });
        (result as any).parse = vi.fn(async () => parsed);
        (result as any).error = vi.fn((message: string) => { throw new Error(message); });
        return result;
    }

    it('forwards interactive output by default', async () => {
        await (await command(['--clean'])).run();

        expect(createContext).toHaveBeenCalled();
        expect(run).toHaveBeenCalledWith('pnpm', ['--dir', '.development/docs-migration', 'run', 'start', '--clean'], { cwd: '/repo', verbosity: RunVerbosity.Output });
    });

    it('requires --yes before suppressing an interactive prompt', async () => {
        await expect((await command(['--clean', '--quiet'])).run()).rejects.toThrow('--quiet requires --yes');
        expect(run).not.toHaveBeenCalled();

        await (await command(['--clean', '--quiet', '--yes'])).run();
        expect(run).toHaveBeenCalledWith('pnpm', ['--dir', '.development/docs-migration', 'run', 'start', '--clean', '--yes'], { cwd: '/repo', verbosity: RunVerbosity.Command });
    });
});
