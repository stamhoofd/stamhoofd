import { afterEach, expect, it, vi } from 'vitest';
import { runProcess } from '@node/opentelemetry-process';
import { exec, execResult } from './process.js';
import { withCliTelemetry } from './telemetry.js';
import { RunVerbosity } from './verbosity.js';

vi.mock('@node/opentelemetry-process', async importOriginal => ({
    ...await importOriginal<typeof import('@node/opentelemetry-process')>(),
    runProcess: vi.fn(async () => ({ code: 0, stdout: '', stderr: '', signal: null })),
}));
afterEach(() => vi.clearAllMocks());

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
