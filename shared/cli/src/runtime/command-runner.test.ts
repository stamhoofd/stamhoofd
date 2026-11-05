import { afterEach, expect, it, vi } from 'vitest';
import { run, RunVerbosity } from './command-runner.js';
import { execResult } from './process.js';

vi.mock('./process.js', () => ({ execResult: vi.fn(async () => ({ code: 0, stdout: 'value', stderr: '(no stderr returned)' })) }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

it('preserves ambient environment and allows explicit overrides', async () => {
    vi.stubEnv('STAM_TEST_AMBIENT', 'ambient');
    await run('example', [], { env: { CUSTOM: 'override' } });
    expect(execResult).toHaveBeenCalledWith('example', [], expect.objectContaining({ env: expect.objectContaining({ STAM_TEST_AMBIENT: 'ambient', CUSTOM: 'override' }), label: undefined }));
});

it('preserves captured result shape and empty stderr', async () => {
    await expect(run('example', [], { capture: true })).resolves.toEqual({ status: 0, stdout: 'value', stderr: '' });
    expect(execResult).toHaveBeenCalledWith('example', [], expect.objectContaining({ capture: true, inheritStdin: false }));
});

it('suppresses explicit quiet probes and keeps failed stderr in the error', async () => {
    vi.mocked(execResult).mockResolvedValueOnce({ code: 2, stdout: '', stderr: 'useful failure', signal: null });
    await expect(run('example', [], { verbosity: RunVerbosity.Quiet })).rejects.toThrow('useful failure');
    const options = vi.mocked(execResult).mock.calls[0][2]!;
    expect(options.label).toBe(false);
    expect(options.log?.('error', 'hidden', {})).toBe(false);
});

it('retains nonzero codes when failure is explicitly allowed', async () => {
    vi.mocked(execResult).mockResolvedValueOnce({ code: 2, stdout: 'changes', stderr: '', signal: null });
    await expect(run('example', [], { capture: true, allowFailure: true })).resolves.toMatchObject({ status: 2, stdout: 'changes' });
});

it('retains allowed spawn failures for tool availability checks', async () => {
    vi.mocked(execResult).mockRejectedValueOnce(new Error('ENOENT'));
    await expect(run('missing', [], { capture: true, allowFailure: true })).resolves.toEqual({ status: 1, stdout: '', stderr: 'ENOENT' });
});

it('uses coordinated stdin and normal output for output-mode commands', async () => {
    await run('example', [], { verbosity: RunVerbosity.Output });
    expect(execResult).toHaveBeenCalledWith('example', [], expect.objectContaining({ inheritStdin: true, output: 'always' }));
});
