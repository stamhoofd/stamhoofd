import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run, RunVerbosity } from './command-runner.js';
import { OutputStream, writeOutputChunk, writeOutputLine } from './output-target.js';

vi.mock('node:child_process', () => ({
    spawn: vi.fn(),
}));

vi.mock('./output-target.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('./output-target.js')>(),
    writeOutputLine: vi.fn(),
    writeOutputChunk: vi.fn(),
}));

vi.mock('./ux.js', () => ({
    command: vi.fn((value: string) => value),
    warning: vi.fn(),
}));

describe('command runner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('prints commands by default while suppressing child output', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as never);

        const promise = run('git', ['status']);
        child.stdout.emit('data', 'hidden output');
        child.emit('exit', 0);

        await expect(promise).resolves.toBeUndefined();
        expect(writeOutputLine).toHaveBeenCalledWith('  git status');
        expect(spawn).toHaveBeenCalledWith('git', ['status'], expect.objectContaining({ stdio: ['ignore', 'ignore', 'pipe'] }));
    });

    it('prints captured output in verbose mode while preserving the result', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as never);

        const promise = run('git', ['status'], { capture: true, verbosity: RunVerbosity.Output });
        child.stdout.emit('data', 'ok');
        child.emit('exit', 0);

        await expect(promise).resolves.toEqual({ stdout: 'ok', stderr: '', status: 0 });
        expect(writeOutputChunk).toHaveBeenCalledWith('ok', OutputStream.Stdout);
    });

    it('prints captured stderr in verbose mode while preserving the result', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as never);

        const promise = run('security', ['verify-cert'], { capture: true, allowFailure: true, verbosity: RunVerbosity.Output });
        child.stderr.emit('data', 'certificate not trusted\n');
        child.emit('exit', 1);

        await expect(promise).resolves.toEqual({ stdout: '', stderr: 'certificate not trusted\n', status: 1 });
        expect(writeOutputChunk).toHaveBeenCalledWith('certificate not trusted\n', OutputStream.Stderr);
    });

    it('prints verbose quiet command output and retains stderr in failures', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as never);

        const promise = run('caddy', ['stop'], { verbosity: RunVerbosity.Output });
        child.stdout.emit('data', 'stopping\n');
        child.stderr.emit('data', 'failed\n');
        child.emit('exit', 1);

        await expect(promise).rejects.toThrow('caddy stop exited with status 1: failed');
        expect(writeOutputChunk).toHaveBeenCalledWith('stopping\n', OutputStream.Stdout);
        expect(writeOutputChunk).toHaveBeenCalledWith('failed\n', OutputStream.Stderr);
    });

    it('does not print quiet commands and includes stderr on failure', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as never);

        const promise = run('podman', ['run', 'docker.io/example/image:latest'], { verbosity: RunVerbosity.Quiet });
        child.stderr.emit('data', 'Error: real failure\n');
        child.emit('exit', 125);

        await expect(promise).rejects.toThrow('podman run docker.io/example/image:latest exited with status 125: Error: real failure');
        expect(writeOutputLine).not.toHaveBeenCalled();
    });

    it('forwards verbose child output through parent stderr for live rendering', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as never);
        const promise = run('pnpm', ['run', 'build'], { verbosity: RunVerbosity.Output });
        child.stdout.emit('data', Buffer.from('build started\n'));
        child.stderr.emit('data', Buffer.from('build warning\n'));
        child.emit('exit', 0);

        await expect(promise).resolves.toBeUndefined();
        expect(writeOutputLine).toHaveBeenCalledWith('  pnpm run build');
        expect(spawn).toHaveBeenCalledWith('pnpm', ['run', 'build'], expect.objectContaining({ stdio: ['inherit', 'pipe', 'pipe'] }));
        expect(writeOutputChunk).toHaveBeenCalledWith(Buffer.from('build started\n'), OutputStream.Stdout);
        expect(writeOutputChunk).toHaveBeenCalledWith(Buffer.from('build warning\n'), OutputStream.Stderr);
    });

    it('returns captured output while forwarding it in verbose mode', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as never);
        const promise = run('git', ['status'], { capture: true, verbosity: RunVerbosity.Output });
        child.stdout.emit('data', 'ok');
        child.stderr.emit('data', 'warning');
        child.emit('exit', 0);

        await expect(promise).resolves.toEqual({ stdout: 'ok', stderr: 'warning', status: 0 });
        expect(writeOutputLine).toHaveBeenCalledWith('  git status');
        expect(writeOutputChunk).toHaveBeenCalledWith('ok', OutputStream.Stdout);
        expect(writeOutputChunk).toHaveBeenCalledWith('warning', OutputStream.Stderr);
        expect(spawn).toHaveBeenCalledWith('git', ['status'], expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }));
    });
});

function createChild(): EventEmitter & { stdout: EventEmitter; stderr: EventEmitter } {
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    return child;
}
