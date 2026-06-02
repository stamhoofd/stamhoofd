import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { run } from './command-runner.js';
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
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('prints captured commands when verbose mode is enabled', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as never);

        const promise = run('git', ['status'], { capture: true, verbose: true });
        child.stdout.emit('data', 'ok');
        child.stderr.emit('data', '');
        child.emit('exit', 0);

        await expect(promise).resolves.toEqual({ stdout: 'ok', stderr: '', status: 0 });
        expect(writeOutputLine).toHaveBeenCalledWith('  git status');
    });

    it('includes stderr in failed quiet command errors', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as never);

        const promise = run('podman', ['run', 'docker.io/example/image:latest'], { quiet: true });
        child.stderr.emit('data', 'Error: real failure\n');
        child.emit('exit', 125);

        await expect(promise).rejects.toThrow('podman run docker.io/example/image:latest exited with status 125: Error: real failure');
    });
});

function createChild(): EventEmitter & { stdout: EventEmitter; stderr: EventEmitter } {
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    return child;
}
