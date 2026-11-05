import { expect, it } from 'vitest';
import { runProcess } from './process.js';

it('returns captured output but redacts split credentials in diagnostics and failure stderr', async () => {
    const messages: string[] = [];
    const result = await runProcess(process.execPath, ['-e', `
        process.stdout.write('payload');
        process.stderr.write('a secret-');
        setTimeout(() => { process.stderr.write('token failure'); process.exitCode = 2; }, 20);
    `], { capture: true, redact: ['secret-token'], log: (_level, message, fields) => { if (fields['diagnostic.kind'] !== 'command') messages.push(message); } });
    expect(result).toEqual({ code: 2, stdout: 'payload', stderr: 'a [redacted] failure' });
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
