import { Parser } from '@oclif/core';
import { expect, it, vi } from 'vitest';
import { BaseCommand } from './base-command.js';
import { createContext } from './context/create-context.js';
import { RunVerbosity } from './runtime/command-runner.js';
import { withCliTelemetry } from './runtime/telemetry.js';

vi.mock('./context/create-context.js', () => ({ createContext: vi.fn(async () => ({ rootDir: '/repo' })) }));
vi.mock('./runtime/telemetry.js', () => ({ withCliTelemetry: vi.fn(async (_name, _verbosity, callback) => callback()) }));

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

it('parses once, resolves verbosity and encloses command cleanup without creating a development context', async () => {
    vi.clearAllMocks();
    const runHook = vi.fn(async () => ({ successes: [] }));
    const cleanup = vi.fn();
    class LifecycleCommand extends BaseCommand {
        static id = 'test:lifecycle';
        static flags = BaseCommand.verbosityFlags();
        protected async init() {}
        protected async finally() { cleanup(); }
        async run() {
            const { flags } = await this.parse(LifecycleCommand);
            return flags.verbose;
        }

        invoke() { return this._run(); }
    }
    const command = new LifecycleCommand(['-v'], { runHook, scopedEnvVarKeys: () => [] } as never);
    await expect(command.invoke()).resolves.toBe(true);
    expect(runHook).toHaveBeenCalledOnce();
    expect(withCliTelemetry).toHaveBeenCalledWith('stam.test.lifecycle', RunVerbosity.Output, expect.any(Function));
    expect(cleanup).toHaveBeenCalledOnce();
    expect(createContext).not.toHaveBeenCalled();
});

it('does not start telemetry or run the command for invalid flags', async () => {
    vi.clearAllMocks();
    class InvalidCommand extends BaseCommand {
        async run() { throw new Error('must not execute'); }
        invoke() { return this._run(); }
    }
    const command = new InvalidCommand(['--unknown'], { runHook: async () => ({ successes: [] }) } as never);
    await expect(command.invoke()).rejects.toThrow();
    expect(withCliTelemetry).not.toHaveBeenCalled();
});
