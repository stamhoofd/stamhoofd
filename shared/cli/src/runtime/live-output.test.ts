import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OutputStream } from './output-target.js';
import { createLiveOutput, StatusItemKind } from './live-output.js';

const logUpdateMock = vi.hoisted(() => {
    const fn = vi.fn();
    return Object.assign(fn, {
        clear: vi.fn(),
        done: vi.fn(),
    });
});

vi.mock('log-update', () => ({
    default: logUpdateMock,
}));

vi.mock('./ux.js', () => ({
    link: vi.fn((label: string, url: string) => `${label}|${url}`),
}));

describe('createLiveOutput', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uses log-update in TTY mode and redraws around writes', () => {
        const stdout = createStream(true);
        const stderr = createStream(true);
        const output = createLiveOutput({ stdout, stderr });

        output.setStatus([
            { label: 'instance main', kind: StatusItemKind.Success },
            { label: 'dashboard https://example.com', href: 'https://example.com' },
        ]);
        output.write('hello\n');
        output.write('boom\n', OutputStream.Stderr);

        expect(logUpdateMock).toHaveBeenCalledWith(expect.stringContaining('instance main'));
        expect(logUpdateMock.clear).toHaveBeenCalledTimes(2);
        expect(stdout.write).toHaveBeenCalledWith('hello\n');
        expect(stderr.write).toHaveBeenCalledWith('boom\n');
    });

    it('prints static output once in non-TTY mode', () => {
        const stdout = createStream(false);
        const output = createLiveOutput({ stdout, stderr: createStream(false) });

        output.setStatus([{ label: 'instance main' }]);
        output.setStatus([{ label: 'instance main' }]);
        output.log('Starting app processes...');
        output.write('hello\n');

        expect(logUpdateMock).not.toHaveBeenCalled();
        expect(stdout.write).toHaveBeenNthCalledWith(1, 'instance main\n');
        expect(stdout.write).toHaveBeenNthCalledWith(2, 'instance main\n');
        expect(stdout.write).toHaveBeenNthCalledWith(3, 'Starting app processes...\n');
        expect(stdout.write).toHaveBeenNthCalledWith(4, 'hello\n');
    });

    it('persists status when stopped with persistStatus', () => {
        const output = createLiveOutput({ stdout: createStream(true), stderr: createStream(true) });

        output.setStatus([{ label: 'instance main' }]);
        output.stop({ persistStatus: true });

        expect(logUpdateMock.done).toHaveBeenCalledTimes(1);
    });

    it('animates live status only while active', () => {
        vi.useFakeTimers();
        const output = createLiveOutput({ stdout: createStream(true), stderr: createStream(true) });

        output.setLiveStatus(frame => [{ label: `frame ${frame}` }], { intervalMs: 50 });
        vi.advanceTimersByTime(120);
        output.stopLiveStatus();
        vi.advanceTimersByTime(120);

        expect(logUpdateMock).toHaveBeenNthCalledWith(1, 'frame 0');
        expect(logUpdateMock).toHaveBeenNthCalledWith(2, 'frame 1');
        expect(logUpdateMock).toHaveBeenNthCalledWith(3, 'frame 2');
        expect(logUpdateMock).toHaveBeenCalledTimes(3);
    });

    it('clears status when stopped without persistence', () => {
        const output = createLiveOutput({ stdout: createStream(true), stderr: createStream(true) });

        output.setStatus([{ label: 'instance main' }]);
        output.stop();

        expect(logUpdateMock.clear).toHaveBeenCalledTimes(1);
    });
});

function createStream(isTTY: boolean): NodeJS.WriteStream {
    return {
        isTTY,
        write: vi.fn(() => true),
    } as unknown as NodeJS.WriteStream;
}
