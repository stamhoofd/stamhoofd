import { PassThrough } from 'node:stream';
import { expect, it } from 'vitest';
import { Terminal } from './terminal.js';

function fixture(tty = true) {
    const stream = Object.assign(new PassThrough(), { isTTY: tty, columns: 80 });
    let text = '';
    stream.on('data', (chunk: Buffer) => {
        text += chunk.toString();
    });
    const terminal = new Terminal({ stdout: stream as unknown as NodeJS.WriteStream, stderr: stream as unknown as NodeJS.WriteStream });
    return { terminal, stream, text: () => text };
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
    await terminal.withPrompt(async () => {
        terminal.write('x'.repeat(65537));
    });
    expect(text()).toBe('\n[output omitted while terminal was suspended]\n');
    terminal.dispose();
});

it('replaces a successful prompt area and restores other live regions', async () => {
    const { terminal, text } = fixture();
    const region = terminal.createRegion();
    region.update('other operation');
    await terminal.withTransientOutput('? sudo install', async (write) => {
        expect(terminal.isSuspended).toBe(true);
        expect(text()).toContain('? sudo install\n');
        write('[sudo] password: ');
        write('\n');
        terminal.write('deferred\n');
        expect(text()).not.toContain('deferred');
    }, success => `${success ? '✓' : '✗'} sudo install`);
    expect(text()).toContain('[sudo] password: \n\r\x1b[2A\x1b[0J✓ sudo install\ndeferred\nother operation\n');
    expect(terminal.isSuspended).toBe(false);
    terminal.dispose();
});

it('retains failed output, closes partial lines and restores terminal ownership', async () => {
    const { terminal, text } = fixture();
    await expect(terminal.withTransientOutput('? sudo install', async (write) => {
        write('sudo: incorrect password');
        throw new Error('failed');
    }, success => `${success ? '✓' : '✗'} sudo install`)).rejects.toThrow('failed');
    expect(text()).toBe('? sudo install\nsudo: incorrect password\n✗ sudo install\n');
    expect(terminal.isSuspended).toBe(false);
    terminal.dispose();
});

it('accounts for wrapped command and prompt lines', async () => {
    const { terminal, stream, text } = fixture();
    stream.columns = 10;
    await terminal.withTransientOutput('? sudo install', async (write) => {
        write('password: \n');
    }, () => '✓ done');
    expect(text()).toContain('\r\x1b[3A\x1b[0J✓ done\n');
    terminal.dispose();
});

it('replaces the pending line when credentials were already cached', async () => {
    const { terminal, text } = fixture();
    await terminal.withTransientOutput('? sudo install', async () => {}, () => '✓ sudo install');
    expect(text()).toBe('? sudo install\n\r\x1b[1A\x1b[0J✓ sudo install\n');
    terminal.dispose();
});

it.each(['redirected', 'resize', 'scroll', 'cursor-control', 'unicode'])('preserves successful output when replacement is unsafe: %s', async (scenario) => {
    const { terminal, stream, text } = fixture(scenario !== 'redirected');
    await terminal.withTransientOutput('? sudo install', async (write) => {
        if (scenario === 'resize') stream.columns = 40;
        write(scenario === 'scroll' ? 'line\n'.repeat(30) : scenario === 'cursor-control' ? '\x1b[2J' : scenario === 'unicode' ? '密碼\n' : 'password: \n');
    }, () => '✓ done');
    expect(text()).not.toContain('\x1b[0J');
    expect(text()).toContain('✓ done\n');
    terminal.dispose();
});
