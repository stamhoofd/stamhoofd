import { expect, it } from 'vitest';
import { runProcess } from './process.js';

it('does not emit a prefix of overlapping credentials', async () => {
    let output = '';
    await runProcess(process.execPath, ['-e', "process.stdout.write('abcdefghijklmnopqrst')"], {
        redact: ['abcdefghij', 'jkl'],
        log: (_level, message, fields) => {
            if (fields['diagnostic.kind'] === 'stdout') output += message;
        },
    });
    expect(output).toBe('[redacted]mnopqrst');
});

it('emits overlapping redactions before a repetitive stream ends', async () => {
    const controller = new AbortController();
    let output = '';
    const result = await runProcess(
        process.execPath,
        ['-e', "setInterval(() => process.stdout.write('a'.repeat(8192)), 5)"],
        {
            redact: ['aa'],
            signal: controller.signal,
            timeoutMs: 2000,
            log: (_level, message, fields) => {
                if (fields['diagnostic.kind'] === 'stdout') {
                    output += message;
                    controller.abort();
                }
            },
        },
    );
    expect(result.reason).toBe('aborted');
    expect(output).toBe('[redacted]');
});

it.each([
    { chunks: ['aaaa', 'aaaa', '!'], secrets: ['aa'], expected: '[redacted]!' },
    { chunks: ['abc', 'def', '!'], secrets: ['abc', 'bcdef'], expected: '[redacted]!' },
    { chunks: ['abc', 'abc'], secrets: ['abc'], expected: '[redacted][redacted]' },
    {
        chunks: ['safe ab', 'cdef', ' tail'],
        secrets: ['abcd', 'cdef'],
        expected: 'safe [redacted] tail',
    },
    { chunks: ['abc', 'ab'], secrets: ['abc'], expected: '[redacted]ab' },
])('preserves streaming redaction boundaries: $chunks', async ({ chunks, secrets, expected }) => {
    let output = '';
    const result = await runProcess(
        process.execPath,
        [
            '-e',
            `
        const chunks = ${JSON.stringify(chunks)};
        const timer = setInterval(() => {
            process.stdout.write(chunks.shift());
            if (!chunks.length) clearInterval(timer);
        }, 10);
    `,
        ],
        {
            redact: secrets,
            log: (_level, message, fields) => {
                if (fields['diagnostic.kind'] === 'stdout') output += message;
            },
        },
    );
    expect(result.code).toBe(0);
    expect(output).toBe(expected);
});
