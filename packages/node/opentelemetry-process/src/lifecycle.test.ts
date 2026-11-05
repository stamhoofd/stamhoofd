import { Readable } from 'node:stream';
import { expect, it, vi } from 'vitest';
import { processError, runProcess } from './process.js';

it('does not spawn for an already aborted signal', async () => {
    const result = await runProcess('nonexistent-executable', [], { signal: AbortSignal.abort() });
    expect(result).toMatchObject({ code: 130, reason: 'aborted', signal: null });
});

it('cancels an active child and retains its signal', async () => {
    const abort = new AbortController();
    const result = await runProcess(process.execPath, ['-e', "console.log('ready'); setInterval(() => {}, 1000)"], {
        signal: abort.signal,
        log: (_level, message, fields) => { if (fields['diagnostic.kind'] === 'stdout' && message.includes('ready')) abort.abort(); },
    });
    expect(result).toMatchObject({ code: 130, reason: 'aborted', signal: 'SIGTERM' });
});

it('terminates a hung child at its deadline', async () => {
    const result = await runProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 100 });
    expect(result).toMatchObject({ code: 124, reason: 'timeout' });
});

it.skipIf(process.platform === 'win32')('escalates group cancellation after the direct child closes its pipes', async () => {
    const controller = new AbortController();
    const kill = vi.spyOn(process, 'kill');
    let group: number | undefined;
    try {
        const result = await runProcess(process.execPath, ['-e', `
            const { spawn } = require('node:child_process');
            const descendant = spawn(process.execPath, ['-e', \`
                process.on('SIGTERM', () => {});
                setInterval(() => {}, 1000);
                process.send('ready');
                process.disconnect();
            \`], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
            descendant.on('message', () => process.stdout.write('ready\\n'));
        `], {
            processGroup: true,
            signal: controller.signal,
            killAfterMs: 50,
            timeoutMs: 3000,
            log: (_level, message, fields) => {
                if (fields['diagnostic.kind'] === 'stdout' && message.includes('ready')) controller.abort();
            },
        });
        group = kill.mock.calls.find(([, signal]) => signal === 'SIGTERM')?.[0];
        expect(result.reason).toBe('aborted');
        expect(group).toBeLessThan(0);
        expect(kill).toHaveBeenCalledWith(group, 'SIGKILL');
    } finally {
        group ??= kill.mock.calls.find(([, signal]) => signal === 'SIGTERM')?.[0];
        kill.mockRestore();
        if (group !== undefined) {
            try {
                process.kill(group, 'SIGKILL');
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
            }
        }
    }
});

it.each([
    { inheritStdio: true, capture: true },
    { inheritStdio: true, sanitizeStdout: (text: string) => text },
])('rejects incompatible passthrough options before spawning: %j', async (options) => {
    await expect(runProcess('nonexistent-executable', [], options)).rejects.toThrow('Inherited stdio cannot be combined with capture or stdout sanitization.');
});

it('fails on capture overflow instead of returning successful truncated JSON', async () => {
    const result = await runProcess(process.execPath, ['-e', "process.stdout.write('x'.repeat(10000))"], { capture: true, maxCaptureChars: 50 });
    expect(result).toMatchObject({ code: 1, reason: 'output-limit' });
    expect(result.stdout).toHaveLength(50);
});

it('pipes streamed input with backpressure and tolerates a throwing diagnostic sink', async () => {
    const result = await runProcess(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], {
        input: Readable.from(['hello', ' world']), capture: true,
        log: () => { throw new Error('sink unavailable'); },
    });
    expect(result).toMatchObject({ code: 0, stdout: 'hello world', signal: null });
});

it('retains redacted stderr after the diagnostic limit is reached', async () => {
    let diagnostics = '';
    const result = await runProcess(process.execPath, ['-e', "process.stderr.write('secret failure')"], {
        redact: ['secret'], maxDiagnosticChars: 1,
        log: (_level, message, fields) => { if (fields['diagnostic.kind'] === 'stderr') diagnostics += message; },
    });
    expect(diagnostics).toBe('[process diagnostics truncated]\n');
    expect(result.stderr).toBe('[redacted] failure');
});

it.each([true, false, undefined])('includes stderr unless fully acknowledged (%s)', async (acknowledge) => {
    const result = await runProcess(process.execPath, ['-e', "process.stderr.write('permission denied'); process.exitCode = 1"], {
        log: () => acknowledge,
    });
    expect(result.stderrReported).toBe(acknowledge === true);
    const error = processError('Updating credentials failed.', 'op item edit', result);
    expect(error.message).toContain('Updating credentials failed.');
    expect(error.message.includes('permission denied')).toBe(acknowledge !== true);
    expect(result.stderr).toBe('permission denied');
});
