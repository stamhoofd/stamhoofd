import { PassThrough } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { stripVTControlCharacters } from 'node:util';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { withSpan, log, withLogSink } from '@common/opentelemetry-decorators';
import { TerminalRenderer } from './terminal.js';
import { Terminal } from '@node/terminal';

afterEach(() => vi.unstubAllEnvs());

it('keeps high-frequency progress out of CI output and includes final span summaries', async () => {
    const stream = new PassThrough();
    let output = '';
    stream.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, color: false });
    const span = { attributes: { 'operation.label': 'Tests: api', 'operation.summary': '42 passed' }, spanContext: () => ({ spanId: 'tests' }), duration: [1, 0], status: { code: 0 } };
    try {
        renderer.onStart(span as never);
        renderer.log('info', '20 completed', { 'span_id': 'tests', 'operation.progress': true, 'operation.progress.liveOnly': true });
        renderer.onEnd(span as never);
        expect(output).toBe('Tests: api...\n✓ Tests: api — 42 passed — 1.0s\n');
    } finally {
        await renderer.shutdown();
    }
});

it('ignores late spans and logs after repeated shutdown without restarting timers', async () => {
    vi.useFakeTimers();
    const stream = Object.assign(new PassThrough(), { isTTY: true });
    const terminal = new Terminal({ stdout: stream as unknown as NodeJS.WriteStream });
    const renderer = new TerminalRenderer({ terminal, color: false });
    let output = '';
    stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    const span = { attributes: { 'operation.label': 'Late' }, spanContext: () => ({ spanId: 'late' }), duration: [0, 0], status: { code: 0 } };
    try {
        await renderer.shutdown();
        await renderer.shutdown();
        renderer.onStart(span as never);
        renderer.onEnd(span as never);
        expect(renderer.log('error', 'Late error', {})).toBe(false);
        expect(output).toBe('');
        expect(vi.getTimerCount()).toBe(0);
        terminal.write('Still usable\n');
        expect(output).toBe('Still usable\n');
    } finally {
        await renderer.shutdown();
        terminal.dispose();
        vi.useRealTimers();
    }
});

it('disposes its region even when terminating a partial output line fails', async () => {
    const stream = new PassThrough();
    const terminal = new Terminal({ stdout: stream as unknown as NodeJS.WriteStream });
    const region = terminal.createRegion();
    const dispose = vi.spyOn(region, 'dispose');
    vi.spyOn(terminal, 'createRegion').mockReturnValue(region);
    const renderer = new TerminalRenderer({ terminal, color: false });
    renderer.log('info', 'partial', { 'diagnostic.kind': 'stdout' });
    const error = new Error('output unavailable');
    const write = vi.spyOn(terminal, 'write').mockImplementation(() => {
        throw error;
    });
    try {
        await expect(renderer.shutdown()).rejects.toBe(error);
        expect(dispose).toHaveBeenCalledOnce();
        await expect(renderer.shutdown()).resolves.toBeUndefined();
        expect(renderer.log('error', 'late', {})).toBe(false);
    } finally {
        write.mockRestore();
        terminal.dispose();
    }
});

it.each([true, false])('keeps the original completion label after progress (TTY: %s)', async (isTTY) => {
    const stream = Object.assign(new PassThrough(), { isTTY });
    let output = '';
    stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, color: false });
    const span = { attributes: { 'operation.label': 'Scanning files' }, spanContext: () => ({ spanId: 'scan' }), duration: [1, 0], status: { code: 0 } };
    try {
        renderer.onStart(span as never);
        renderer.log('info', '25/100 files', { 'span_id': 'scan', 'operation.progress': true });
        expect(output).toContain(isTTY ? 'Scanning files — 25/100 files' : '25/100 files\n');
        renderer.onEnd(span as never);
        expect(output).toContain('✓ Scanning files — 1.0s');
        expect(output).not.toContain('✓ 25/100 files');
    } finally {
        await renderer.shutdown();
    }
});

it.each([true, false])('detects color from the injected terminal (TTY: %s)', async (isTTY) => {
    vi.stubEnv('NO_COLOR', undefined);
    const stream = Object.assign(new PassThrough(), { isTTY });
    const terminal = new Terminal({ stdout: stream as unknown as NodeJS.WriteStream });
    let output = '';
    stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    const renderer = new TerminalRenderer({ terminal });
    try {
        renderer.log('warn', 'Notice', {});
        expect(output.includes('\x1b[33m')).toBe(isTTY);
    } finally {
        await renderer.shutdown();
        terminal.dispose();
    }
});

it.each(['normal', 'quiet'] as const)('shows a static interactive marker and no animation in %s mode', async (verbosity) => {
    vi.stubEnv('NO_COLOR', '1');
    const stream = Object.assign(new PassThrough(), { isTTY: true, columns: 80, rows: 24 });
    let output = '';
    stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, verbosity, color: true });
    await renderer.withInteractiveOperation('sudo install', async (write) => {
        expect(output).toBe(verbosity === 'quiet' ? '' : '? sudo install\n');
        write('Password: \n');
    });
    expect(output).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    expect(output).toBe(verbosity === 'quiet' ? 'Password: \n' : '? sudo install\nPassword: \n\r\x1b[2A\x1b[0J✓ sudo install\n');
    await renderer.shutdown();
});

it('keeps plain split output free of gutters and separates stream changes', async () => {
    const stream = new PassThrough();
    let output = '';
    stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, color: false });
    const fields = { 'diagnostic.output.style': 'plain', 'diagnostic.kind': 'stdout' };
    expect(renderer.log('info', '@backend: first ', fields)).toBe(true);
    renderer.log('info', 'line\nsecond', fields);
    renderer.log('info', 'error\n', { ...fields, 'diagnostic.kind': 'stderr' });
    renderer.log('info', 'ordinary\n', { 'diagnostic.kind': 'stdout' });
    await renderer.shutdown();
    expect(output).toBe('@backend: first line\nsecond\nerror\n  │ ordinary\n');
});

it.each([true, false])('dims command labels throughout their lifetime (TTY: %s)', async (isTTY) => {
    vi.stubEnv('NO_COLOR', undefined);
    const stream = new PassThrough();
    Object.assign(stream, { isTTY });
    let output = '';
    stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, color: true, verbosity: 'verbose' });
    const span = { attributes: { 'operation.label': 'git remote get-url origin', 'operation.label.kind': 'command' }, spanContext: () => ({ spanId: 'command' }), duration: [0, 0], status: { code: 0 } };
    try {
        renderer.onStart(span as never);
        expect(output).toContain('\x1b[2mgit remote get-url origin\x1b[22m');
        output = '';
        renderer.onEnd(span as never);
        expect(output).toContain('\x1b[32m✓\x1b[39m \x1b[2mgit remote get-url origin\x1b[22m');
        expect(output).toContain('\x1b[2m— 0.0s\x1b[22m');
        output = '';
        span.attributes = { 'operation.label': 'Planning infrastructure', 'operation.label.kind': 'description' };
        renderer.onStart(span as never);
        renderer.onEnd(span as never);
        expect(output).toContain('Planning infrastructure');
        expect(output).not.toContain('\x1b[2mPlanning infrastructure');
    } finally { await renderer.shutdown(); }
});

it('suppresses command progress in quiet mode', async () => {
    const stream = new PassThrough();
    let output = '';
    stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, verbosity: 'quiet' });
    const span = { attributes: { 'operation.label': 'git status', 'operation.label.kind': 'command' }, spanContext: () => ({ spanId: 'command' }), duration: [0, 0], status: { code: 0 } };
    renderer.onStart(span as never);
    renderer.onEnd(span as never);
    await renderer.shutdown();
    expect(output).toBe('');
});

it.each(['normal', 'verbose'] as const)('shows command child spans only on request (%s)', async (verbosity) => {
    const stream = new PassThrough();
    let output = '';
    stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, color: false, verbosity });
    const parent = { attributes: { 'operation.label': 'Checking prerequisites' }, spanContext: () => ({ spanId: 'parent' }), duration: [0, 0], status: { code: 0 } };
    const child = { ...parent, attributes: { 'operation.label': 'git --version', 'operation.label.kind': 'command' }, spanContext: () => ({ spanId: 'child' }), parentSpanContext: { spanId: 'parent' } };
    renderer.onStart(parent as never);
    renderer.onStart(child as never);
    renderer.onEnd(child as never);
    renderer.onEnd(parent as never);
    await renderer.shutdown();
    expect(output).toContain('✓ Checking prerequisites');
    expect(output.includes('  ✓ git --version')).toBe(verbosity === 'verbose');
});

it('updates the active live operation when progress is reported', async () => {
    const stream = new PassThrough();
    Object.assign(stream, { isTTY: true });
    let output = '';
    stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, color: false });
    try {
        renderer.onStart({ attributes: { 'operation.label': 'Scanning' }, spanContext: () => ({ spanId: 'scan' }) } as never);
        expect(renderer.log('info', 'Scanned 25/100 files', { 'span_id': 'scan', 'operation.progress': true })).toBe(true);
        expect(output).toContain('Scanned 25/100 files');
    } finally {
        await renderer.shutdown();
    }
});

it.each(['quiet', 'normal', 'verbose'] as const)('acknowledges only visible diagnostics in %s mode', async (verbosity) => {
    const stream = new PassThrough();
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, verbosity });
    expect(renderer.log('debug', 'detail\n', { 'diagnostic.kind': 'stderr' }) === true).toBe(verbosity === 'verbose');
    await renderer.shutdown();
});

it('renders labelled span lifetimes in normal mode without debug records or trace IDs', async () => {
    const stream = new PassThrough();
    let output = '';
    stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, groupBy: ['environment'] });
    const sdk = new NodeSDK({ autoDetectResources: false, spanProcessors: [renderer], logRecordProcessors: [], metricReaders: [] });
    sdk.start();
    try {
        await withLogSink(renderer.log, () => withSpan('sync', async () => {
            log('debug', 'hidden command');
            await Promise.resolve();
        }, { label: 'Synchronizing', fields: { environment: 'staging' } }));
    } finally { await sdk.shutdown(); }
    expect(output).toContain('staging');
    expect(output).toContain('Synchronizing...');
    expect(output).toMatch(/✓ Synchronizing — \d+\.\ds/);
    expect(output).not.toContain('hidden command');
    expect(output).not.toContain('trace_id');
    expect(output).not.toContain('\x1b');
});

it('styles diagnostic roles without changing subprocess content', async () => {
    vi.stubEnv('NO_COLOR', undefined);
    const stream = new PassThrough();
    let output = '';
    stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, verbosity: 'verbose', color: true });
    renderer.log('debug', 'op item list', { 'diagnostic.kind': 'command' });
    renderer.log('debug', 'first ', { 'diagnostic.kind': 'stdout' });
    renderer.log('debug', 'line\nsecond', { 'diagnostic.kind': 'stdout' });
    renderer.log('debug', 'notice\n', { 'diagnostic.kind': 'stderr' });
    renderer.log('warn', 'Retrying', {});
    await renderer.shutdown();
    expect(output).toContain('\x1b[2m$ op item list');
    expect(output).toContain('\x1b[33mWarning: ');
    expect(stripVTControlCharacters(output)).toBe('  $ op item list\n  │ first line\n  │ second\n  │ stderr: notice\nWarning: Retrying\n');
});

it.each([undefined, false, true])('honors NO_COLOR with color override %s', async (color) => {
    vi.stubEnv('NO_COLOR', '1');
    const stream = new PassThrough();
    let output = '';
    stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, verbosity: 'verbose', color, groupBy: ['environment'] });
    renderer.log('debug', 'op item list', { 'diagnostic.kind': 'command', 'environment': 'staging' });
    renderer.log('error', 'Failed', {});
    const span = { attributes: { 'operation.label': 'git status', 'operation.label.kind': 'command' }, spanContext: () => ({ spanId: 'command' }), duration: [0, 0], status: { code: 0 } };
    renderer.onStart(span as never);
    renderer.onEnd(span as never);
    await renderer.shutdown();
    expect(output).toContain('staging');
    expect(output).toContain('Error: Failed');
    expect(output).not.toContain('\x1b');
});
