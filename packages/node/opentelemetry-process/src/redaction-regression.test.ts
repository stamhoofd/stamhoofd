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
