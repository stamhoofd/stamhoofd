import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runProcess } from '@node/opentelemetry-process';
import { execSudo } from './process.js';
import { withCliInteractiveOperation } from './telemetry.js';

const write = vi.hoisted(() => vi.fn(() => true));
vi.mock('./telemetry.js', () => ({
    getCliTelemetry: () => undefined,
    withCliPrompt: (callback: () => Promise<unknown>) => callback(),
    withCliInteractiveOperation: vi.fn((_label: string, callback: (writer: typeof write) => Promise<unknown>) => callback(write)),
}));
vi.mock('@node/opentelemetry-process', async importOriginal => ({
    ...await importOriginal<typeof import('@node/opentelemetry-process')>(),
    runProcess: vi.fn(),
}));

const tty = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
    vi.mocked(runProcess).mockResolvedValue({ code: 0, stdout: '', stderr: '', signal: null });
});
afterEach(() => {
    if (tty) Object.defineProperty(process.stdin, 'isTTY', tty);
    else Reflect.deleteProperty(process.stdin, 'isTTY');
});

it('shows the redacted command before execution and lets sudo read terminal stdin', async () => {
    await execSudo(['install', 'private value'], { redact: ['private value'] });
    expect(withCliInteractiveOperation).toHaveBeenCalledWith('sudo install "[redacted]"', expect.any(Function));
    expect(runProcess).toHaveBeenCalledWith('sudo', ['-S', 'install', 'private value'], expect.objectContaining({ inheritStdin: true, processGroup: false, label: false, output: 'always', redact: ['private value'] }));
    expect(vi.mocked(withCliInteractiveOperation).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(runProcess).mock.invocationCallOrder[0]);
    const options = vi.mocked(runProcess).mock.calls[0][2]!;
    expect(options.input).toBeUndefined();
    expect(options.capture).toBeUndefined();
    expect(options.log?.('info', 'Password: ', { 'diagnostic.kind': 'stderr' })).toBe(true);
    expect(write).toHaveBeenCalledExactlyOnceWith('Password: ');
    expect(options.log?.('debug', 'sudo -S install', { 'diagnostic.kind': 'command' })).toBe(false);
    expect(write).toHaveBeenCalledOnce();
});

it.each([1, 130])('propagates exit code %s so failure or cancellation retains diagnostics', async (code) => {
    vi.mocked(runProcess).mockResolvedValueOnce({ code, stdout: '', stderr: 'denied', signal: null });
    await expect(execSudo(['install'])).rejects.toThrow('denied');
});

it('retains native sudo behavior without terminal stdin', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });
    await execSudo(['install']);
    expect(runProcess).toHaveBeenCalledWith('sudo', ['install'], expect.objectContaining({ inheritStdio: true }));
    expect(withCliInteractiveOperation).not.toHaveBeenCalled();
});
