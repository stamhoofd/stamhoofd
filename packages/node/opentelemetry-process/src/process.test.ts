import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runProcess } from './process.js';

afterEach(() => vi.unstubAllEnvs());

it('retains a redacted failure log when the sink cannot present it', async () => {
    const result = await runProcess(process.execPath, ['-e', "process.stdout.write('secret failure'); process.exitCode = 1"], {
        output: 'on-failure', redact: ['secret'], log: () => false,
    });
    expect(result.diagnosticsFile).toBeDefined();
    try {
        const text = await fs.readFile(result.diagnosticsFile!, 'utf8');
        expect(text).toContain('[redacted]');
        expect(text).not.toContain('secret');
    } finally {
        await fs.rm(path.dirname(result.diagnosticsFile!), { recursive: true, force: true });
    }
});

it.each([0, 2, 'abort', 'spawn-error'] as const)('removes private diagnostic spools after %s', async (exit) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'process-spool-test-'));
    vi.stubEnv('TMPDIR', directory);
    const controller = new AbortController();
    try {
        const promise = runProcess(exit === 'spawn-error' ? '/nonexistent-stam-process' : process.execPath, ['-e', exit === 'abort' ? "process.stdout.write('started'); setInterval(() => {}, 1000)" : `process.stdout.write('output'); process.exitCode = ${exit}`], {
            output: 'on-failure', signal: controller.signal,
            log: (_level, _message, fields) => {
                if (fields['diagnostic.kind'] !== 'command') expect(exit).toBe(2);
                return true;
            },
        });
        if (exit === 'abort') controller.abort();
        if (exit === 'spawn-error') await expect(promise).rejects.toThrow();
        else expect((await promise).code).toBe(exit === 'abort' ? 130 : exit);
        expect(await fs.readdir(directory)).toEqual([]);
    } finally {
        controller.abort();
        await fs.rm(directory, { recursive: true, force: true });
    }
});

it.each([0, 2])('only presents failure diagnostics after exit (code %s)', async (code) => {
    const messages: { kind: unknown; text: string }[] = [];
    const result = await runProcess(process.execPath, ['-e', `
        process.stdout.write('stdout secret');
        setTimeout(() => { process.stderr.write('stderr secret'); process.exitCode = ${code}; }, 20);
    `], {
        output: 'on-failure',
        redact: ['secret'],
        log: (level, message, fields) => {
            if (fields['diagnostic.kind'] !== 'command') {
                expect(level).toBe('error');
                messages.push({ kind: fields['diagnostic.kind'], text: message });
            }
            return true;
        },
    });
    expect(result.code).toBe(code);
    for (const kind of ['stdout', 'stderr']) {
        expect(messages.filter(message => message.kind === kind).map(message => message.text).join('')).toBe(code === 0 ? '' : `${kind} [redacted]`);
    }
    if (code !== 0) expect(result.stderrReported).toBe(true);
});

it('retains stdout failures beyond the streaming diagnostic limit', async () => {
    const messages: string[] = [];
    const result = await runProcess(process.execPath, ['-e', "process.stdout.write('x'.repeat(20000) + 'THE FAILURE'); process.exitCode = 1;"], {
        output: 'on-failure',
        maxDiagnosticChars: 10,
        log: (_level, message, fields) => {
            if (fields['diagnostic.kind'] === 'stdout') messages.push(message);
            return true;
        },
    });
    expect(result.code).toBe(1);
    expect(messages.join('')).toContain('THE FAILURE');
});

it('preserves redaction and diagnostic metadata for plain output', async () => {
    const records: { message: string; fields: Record<string, unknown> }[] = [];
    await runProcess(process.execPath, ['-e', "process.stdout.write('secret output')"], {
        output: 'always', outputStyle: 'plain', redact: ['secret'],
        log: (_level, message, fields) => {
            records.push({ message, fields });
            return true;
        },
    });
    const output = records.filter(record => record.fields['diagnostic.kind'] === 'stdout');
    expect(output.map(record => record.message).join('')).toBe('[redacted] output');
    expect(output.every(record => record.fields['diagnostic.output.style'] === 'plain')).toBe(true);
});

it('returns captured output but redacts split credentials in diagnostics and failure stderr', async () => {
    const messages: string[] = [];
    const result = await runProcess(process.execPath, ['-e', `
        process.stdout.write('payload');
        process.stderr.write('a secret-');
        setTimeout(() => { process.stderr.write('token failure'); process.exitCode = 2; }, 20);
    `], { capture: true, redact: ['secret-token'], log: (_level, message, fields) => { if (fields['diagnostic.kind'] !== 'command') messages.push(message); } });
    expect(result).toMatchObject({ code: 2, stdout: 'payload', stderr: 'a [redacted] failure', signal: null });
    expect(messages.join('')).not.toContain('secret-token');
    expect(messages.join('')).toContain('[redacted]');
});

it('withholds diagnostics when structured output cannot be sanitized', async () => {
    const messages: string[] = [];
    const result = await runProcess(process.execPath, ['-e', "process.stdout.write('private-output')"], {
        capture: true,
        sanitizeStdout: () => { throw new Error('Bad format'); },
        log: (_level, message, fields) => { if (fields['diagnostic.kind'] === 'stdout') messages.push(message); },
    });
    expect(result.stdout).toBe('private-output');
    expect(messages.join('')).toContain('stdout withheld');
    expect(messages.join('')).not.toContain('private-output');
});
