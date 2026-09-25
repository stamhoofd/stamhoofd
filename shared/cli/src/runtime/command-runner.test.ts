import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run, RunVerbosity } from './command-runner.js';
import { writeOutputLine } from './output-target.js';

vi.mock('node:child_process', () => ({
    spawn: vi.fn(),
}));

vi.mock('./output-target.js', () => ({
    writeOutputLine: vi.fn(),
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
        const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        const promise = run('pnpm', ['run', 'build'], { verbosity: RunVerbosity.Output });
        child.stdout.emit('data', Buffer.from('build started\n'));
        child.stderr.emit('data', Buffer.from('build warning\n'));
        child.emit('exit', 0);

        await expect(promise).resolves.toBeUndefined();
        expect(writeOutputLine).toHaveBeenCalledWith('  pnpm run build');
        expect(spawn).toHaveBeenCalledWith('pnpm', ['run', 'build'], expect.objectContaining({ stdio: ['inherit', 'pipe', 'pipe'] }));
        expect(write).toHaveBeenNthCalledWith(1, Buffer.from('build started\n'));
        expect(write).toHaveBeenNthCalledWith(2, Buffer.from('build warning\n'));
    });

    it('returns captured output without forwarding it', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as never);
        const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        const promise = run('git', ['status'], { capture: true, verbosity: RunVerbosity.Output });
        child.stdout.emit('data', 'ok');
        child.stderr.emit('data', 'warning');
        child.emit('exit', 0);

        await expect(promise).resolves.toEqual({ stdout: 'ok', stderr: 'warning', status: 0 });
        expect(writeOutputLine).toHaveBeenCalledWith('  git status');
        expect(write).not.toHaveBeenCalled();
        expect(spawn).toHaveBeenCalledWith('git', ['status'], expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }));
    });
});

function createChild(): EventEmitter & { stdout: EventEmitter; stderr: EventEmitter } {
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    return child;
}
