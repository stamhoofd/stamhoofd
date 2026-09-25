import { afterEach, describe, expect, it, vi } from 'vitest';
import { OutputStream } from './output-target.js';
import { createLiveOutput, StatusItemKind } from './live-output.js';

vi.mock('./ux.js', () => ({
    link: vi.fn((label: string, url: string) => `${label}|${url}`),
}));

describe('createLiveOutput', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('renders status below stdout and stderr, including direct writes', () => {
        const stdout = createStream(true);
        const stderr = createStream(true);
        const output = createLiveOutput({ stdout: stdout.stream, stderr: stderr.stream });

        output.setStatus([
            { label: 'instance main', kind: StatusItemKind.Success },
            { label: 'dashboard https://example.com', href: 'https://example.com' },
        ]);
        output.write('hello\n');
        output.write('boom\n', OutputStream.Stderr);
        stdout.stream.write('direct log\n');
        output.stop();

        expect(stdout.writes.join('')).toContain('\x1b[1A\x1b[0Jhello\n');
        expect(stdout.writes.join('')).toContain('\x1b[1A\x1b[0Jdirect log\n');
        expect(stdout.writes.filter(write => write.includes('instance main'))).toHaveLength(4);
        expect(stderr.writes).toEqual(['boom\n']);
    });

    it('prints static output once in non-TTY mode', () => {
        const stdout = createStream(false);
        const output = createLiveOutput({ stdout: stdout.stream, stderr: createStream(false).stream });

        output.setStatus([{ label: 'instance main' }]);
        output.setStatus([{ label: 'instance main' }]);
        output.log('Starting app processes...');
        output.write('hello\n');

        expect(stdout.writes).toEqual(['instance main\n', 'instance main\n', 'Starting app processes...\n', 'hello\n']);
    });

    it('persists status when stopped with persistStatus', () => {
        const stdout = createStream(true);
        const output = createLiveOutput({ stdout: stdout.stream, stderr: createStream(true).stream });

        output.setStatus([{ label: 'instance main' }]);
        output.stop({ persistStatus: true });

        expect(stdout.writes).toEqual(['instance main\n']);
    });

    it('animates live status only while active', () => {
        vi.useFakeTimers();
        const stdout = createStream(true);
        const output = createLiveOutput({ stdout: stdout.stream, stderr: createStream(true).stream });

        output.setLiveStatus(frame => [{ label: `frame ${frame}` }], { intervalMs: 50 });
        vi.advanceTimersByTime(120);
        output.stopLiveStatus();
        vi.advanceTimersByTime(120);
        output.stop();

        expect(stdout.writes.filter(write => /frame \d\n/.test(write))).toEqual(['frame 0\n', 'frame 1\n', 'frame 2\n']);
    });

    it('clears status when stopped without persistence', () => {
        const stdout = createStream(true);
        const output = createLiveOutput({ stdout: stdout.stream, stderr: createStream(true).stream });

        output.setStatus([{ label: 'instance main' }]);
        output.stop();

        expect(stdout.writes).toEqual(['instance main\n', '\x1b[1A\x1b[0J']);
    });

    it('clears every terminal line used by a wrapped status', () => {
        const stdout = createStream(true);
        stdout.stream.columns = 20;
        const output = createLiveOutput({ stdout: stdout.stream, stderr: createStream(true).stream });

        output.setStatus([{ label: 'dashboard.stamhoofd  api.stamhoofd' }]);
        output.log('build started');
        output.stop();

        expect(stdout.writes.join('')).toContain('\x1b[2A\x1b[0Jbuild started\n');
    });
});

function createStream(isTTY: boolean): { stream: NodeJS.WriteStream; writes: string[] } {
    const writes: string[] = [];
    return {
        stream: {
            isTTY,
            write(chunk: string | Uint8Array) {
                writes.push(String(chunk));
                return true;
            },
        } as NodeJS.WriteStream,
        writes,
    };
}
