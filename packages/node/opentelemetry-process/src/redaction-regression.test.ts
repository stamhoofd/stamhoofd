import { expect, it } from 'vitest';
import { runProcess } from './process.js';

it('does not emit a prefix of overlapping credentials', async () => {
    let output = '';
    await runProcess(process.execPath, ['-e', "process.stdout.write('abcdefghijklmnopqrst')"], {
        redact: ['abcdefghij', 'jkl'],
        log: (_level, message, fields) => { if (fields['diagnostic.kind'] === 'stdout') output += message; },
    });
    expect(output).toBe('[redacted]mnopqrst');
});

it('emits overlapping redactions before a repetitive stream ends', async () => {
    const controller = new AbortController();
    let output = '';
    const result = await runProcess(process.execPath, ['-e', "setInterval(() => process.stdout.write('a'.repeat(8192)), 5)"], {
        redact: ['aa'],
        signal: controller.signal,
        timeoutMs: 2000,
        log: (_level, message, fields) => {
            if (fields['diagnostic.kind'] === 'stdout') {
                output += message;
                controller.abort();
            }
        },
    });
    expect(result.reason).toBe('aborted');
    expect(output).toBe('[redacted]');
});
