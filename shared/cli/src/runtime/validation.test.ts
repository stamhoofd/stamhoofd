import { afterEach, expect, it, vi } from 'vitest';
import { run, RunVerbosity } from './command-runner.js';
import { runValidation } from './validation.js';
import type { CliContext } from '../context/create-context.js';

vi.mock('./command-runner.js', async importOriginal => ({ ...await importOriginal<typeof import('./command-runner.js')>(), run: vi.fn() }));
afterEach(() => vi.clearAllMocks());

it.each([RunVerbosity.Command, RunVerbosity.Quiet, RunVerbosity.Output])('selects failure-only output except in verbose mode (%s)', async (verbosity) => {
    await runValidation({ rootDir: '/repo', verbosity } as CliContext, 'Lint', ['run', 'lint']);
    expect(run).toHaveBeenCalledWith('pnpm', ['run', 'lint'], expect.objectContaining({
        cwd: '/repo', verbosity, output: verbosity === RunVerbosity.Output ? 'always' : 'on-failure',
    }));
});

it('propagates failures without requiring reporter events', async () => {
    vi.mocked(run).mockRejectedValueOnce(new Error('Setup failed'));
    await expect(runValidation({ rootDir: '/repo' } as CliContext, 'Tests', [], { tests: true })).rejects.toThrow('Setup failed');
    expect(run).toHaveBeenCalledWith('pnpm', [], expect.objectContaining({ env: expect.objectContaining({ STAM_TEST_SOCKET: expect.any(String), STAM_TEST_SESSION: expect.any(String) }) }));
});
