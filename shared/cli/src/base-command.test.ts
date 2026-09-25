import { Parser } from '@oclif/core';
import { expect, it, vi } from 'vitest';
import { BaseCommand } from './base-command.js';
import { createContext } from './context/create-context.js';
import { RunVerbosity } from './runtime/command-runner.js';

vi.mock('./context/create-context.js', () => ({ createContext: vi.fn(async () => ({ rootDir: '/repo' })) }));

class TestCommand extends BaseCommand {
    static flags = BaseCommand.verbosityFlags();

    async run(): Promise<void> {
    }

    async context() {
        const { context } = await this.parseWithContext(TestCommand);
        return context;
    }
}

it('defaults contexts to command verbosity', async () => {
    const command = new TestCommand([], {} as never);

    (command as any).parse = vi.fn(async () => ({ flags: {}, raw: [] }));
    await expect(command.context()).resolves.toEqual({ rootDir: '/repo', verbosity: RunVerbosity.Command });
    (command as any).parse = vi.fn(async () => ({ flags: { verbose: true }, raw: [{ type: 'flag', flag: 'verbose' }] }));
    await expect(command.context()).resolves.toEqual({ rootDir: '/repo', verbosity: RunVerbosity.Output });
    expect(createContext).toHaveBeenCalledWith({ env: 'stamhoofd', instanceName: undefined, verbose: true });
});

it('offers mutually exclusive quiet and verbose flags at command verbosity', async () => {
    const flags = BaseCommand.verbosityFlags();

    await expect(Parser.parse(['--quiet'], { flags })).resolves.toMatchObject({ flags: { quiet: true } });
    await expect(Parser.parse(['-v'], { flags })).resolves.toMatchObject({ flags: { verbose: true } });
    await expect(Parser.parse(['--quiet', '-v'], { flags })).rejects.toThrow();
});
