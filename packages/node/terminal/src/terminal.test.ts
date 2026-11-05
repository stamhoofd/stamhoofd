import { PassThrough } from 'node:stream';
import { expect, it } from 'vitest';
import { Terminal } from './terminal.js';

function fixture(tty = true) {
    const stream = Object.assign(new PassThrough(), { isTTY: tty, columns: 80 });
    let text = '';
    stream.on('data', (chunk: Buffer) => { text += chunk.toString(); });
    const terminal = new Terminal({ stdout: stream as unknown as NodeJS.WriteStream, stderr: stream as unknown as NodeJS.WriteStream });
    return { terminal, text: () => text };
}

it('retains other live regions when one finishes', () => {
    const { terminal, text } = fixture();
    const first = terminal.createRegion();
    const second = terminal.createRegion();
    first.update('first');
    second.update('second');
    first.finish('done');
    expect(text()).toContain('done\nsecond\n');
    terminal.dispose();
    const previous = text();
    second.update('late');
    expect(text()).toBe(previous);
});

it('defers output and redraws latest progress even when a prompt rejects', async () => {
    const { terminal, text } = fixture();
    const region = terminal.createRegion();
    region.update('before');
    await expect(terminal.withPrompt(async () => {
        region.update('after');
        terminal.write('deferred\n');
        expect(text()).not.toContain('after');
        expect(text()).not.toContain('deferred');
        throw new Error('cancelled');
    })).rejects.toThrow('cancelled');
    expect(text()).toContain('deferred\nafter\n');
    terminal.dispose();
});

it('keeps redirected output plain and bounds prompt buffering', async () => {
    const { terminal, text } = fixture(false);
    terminal.createRegion().update('hidden');
    await terminal.withPrompt(async () => { terminal.write('x'.repeat(65537)); });
    expect(text()).toBe('\n[output omitted while terminal was suspended]\n');
    terminal.dispose();
});
