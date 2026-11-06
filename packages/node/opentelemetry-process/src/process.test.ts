import { expect, it } from 'vitest';
import { runProcess } from './process.js';

it.each([0, 2])('only presents failure diagnostics after exit (code %s)', async (code) => {
    const messages: string[] = [];
    const result = await runProcess(process.execPath, ['-e', `
        process.stdout.write('stdout secret');
        setTimeout(() => { process.stderr.write('stderr secret'); process.exitCode = ${code}; }, 20);
    `], {
        output: 'on-failure' as any,
        redact: ['secret'],
        log: (level, message, fields) => {
            if (fields['diagnostic.kind'] !== 'command') {
                expect(level).toBe('error');
                messages.push(message);
            }
            return true;
        },
    });
    expect(result.code).toBe(code);
    expect(messages.join('')).toBe(code === 0 ? '' : 'stdout [redacted]stderr [redacted]');
    if (code !== 0) expect(result.stderrReported).toBe(true);
});

it('retains stdout failures beyond the streaming diagnostic limit', async () => {
    const messages: string[] = [];
    const result = await runProcess(process.execPath, ['-e', "process.stdout.write('x'.repeat(20000) + 'THE FAILURE'); process.exitCode = 1;"], {
        output: 'on-failure' as any,
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
