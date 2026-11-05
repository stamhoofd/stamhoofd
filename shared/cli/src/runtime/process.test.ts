import { afterEach, expect, it, vi } from 'vitest';
import { runProcess } from '@node/opentelemetry-process';
import { exec, execResult } from './process.js';
import { getCliTelemetry, withCliTelemetry } from './telemetry.js';
import { RunVerbosity } from './verbosity.js';

vi.mock('@node/opentelemetry-process', async importOriginal => ({
    ...await importOriginal<typeof import('@node/opentelemetry-process')>(),
    runProcess: vi.fn(async () => ({ code: 0, stdout: '', stderr: '', signal: null })),
}));
afterEach(() => vi.clearAllMocks());

it.each(['success', 'failure', 'cancellation'] as const)('restores terminal ownership after native subprocess %s', async (outcome) => {
    await withCliTelemetry('process.test', RunVerbosity.Quiet, async () => {
        const runtime = getCliTelemetry()!;
        vi.mocked(runProcess).mockImplementationOnce(async (_command, _args, options) => {
            expect(runtime.terminal.isSuspended).toBe(true);
            expect(options).toMatchObject({ inheritStdio: true, processGroup: false, signal: runtime.signal });
            if (outcome === 'failure') throw new Error('spawn failed');
            if (outcome === 'cancellation') {
                process.emit('SIGINT');
                expect(options?.signal?.aborted).toBe(true);
                return { code: 130, reason: 'aborted', stdout: '', stderr: '', signal: null };
            }
            return { code: 0, stdout: '', stderr: '', signal: null };
        });
        const result = execResult('sudo', ['example'], { inheritStdio: true });
        if (outcome === 'failure') await expect(result).rejects.toThrow('spawn failed');
        else await expect(result).resolves.toMatchObject({ code: outcome === 'cancellation' ? 130 : 0 });
        expect(runtime.terminal.isSuspended).toBe(false);
    });
});

it('shares the invocation cancellation signal and preserves a complete environment', async () => {
    await withCliTelemetry('process.test', RunVerbosity.Quiet, async () => {
        await exec('example', [], { env: { ONLY: 'this' }, label: 'Example operation' });
        expect(runProcess).toHaveBeenCalledWith('example', [], expect.objectContaining({ env: { ONLY: 'this' }, signal: expect.any(AbortSignal), processGroup: true, label: 'Example operation' }));
    });
});

it('returns meaningful nonzero results but checked execution throws', async () => {
    const result = { code: 2, stdout: 'changes', stderr: 'failure', signal: null };
    vi.mocked(runProcess).mockResolvedValueOnce(result);
    await expect(execResult('example', [])).resolves.toBe(result);
    vi.mocked(runProcess).mockResolvedValueOnce(result);
    await expect(exec('example', [])).rejects.toThrow('failure');
});
