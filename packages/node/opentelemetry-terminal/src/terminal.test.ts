import { PassThrough } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { stripVTControlCharacters } from 'node:util';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { instrumentFunction, log, withLogSink } from '@common/opentelemetry-decorators';
import { TerminalRenderer } from './terminal.js';

afterEach(() => vi.unstubAllEnvs());

it.each(['normal', 'quiet'] as const)('shows a static interactive marker and no animation in %s mode', async (verbosity) => {
    vi.stubEnv('NO_COLOR', '1');
    const stream = Object.assign(new PassThrough(), { isTTY: true, columns: 80, rows: 24 });
    let output = '';
    stream.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, verbosity, color: true });
    await renderer.withInteractiveOperation('sudo install', async (write) => {
        expect(output).toBe(verbosity === 'quiet' ? '' : '? sudo install\n');
        write('Password: \n');
    });
    expect(output).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    if (verbosity === 'quiet') expect(output).toBe('Password: \n');
    else expect(output).toBe('? sudo install\nPassword: \n\r\x1b[2A\x1b[0J✓ sudo install\n');
    await renderer.shutdown();
});

it('keeps plain split output free of gutters and separates stream changes', async () => {
    const stream = new PassThrough();
    let output = '';
    stream.on('data', (chunk: Buffer) => { output += chunk.toString(); });
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
    stream.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, color: true });
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
    stream.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, verbosity: 'quiet' });
    const span = { attributes: { 'operation.label': 'git status', 'operation.label.kind': 'command' }, spanContext: () => ({ spanId: 'command' }), duration: [0, 0], status: { code: 0 } };
    renderer.onStart(span as never);
    renderer.onEnd(span as never);
    await renderer.shutdown();
    expect(output).toBe('');
});

it('updates the active live operation when progress is reported', async () => {
    const stream = new PassThrough();
    Object.assign(stream, { isTTY: true });
    let output = '';
    stream.on('data', (chunk: Buffer) => { output += chunk.toString(); });
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
    stream.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    const renderer = new TerminalRenderer({ stream: stream as unknown as NodeJS.WriteStream, groupBy: ['environment'] });
    const sdk = new NodeSDK({ autoDetectResources: false, spanProcessors: [renderer], logRecordProcessors: [], metricReaders: [] });
    sdk.start();
    try {
        await withLogSink(renderer.log, () => instrumentFunction('sync', async () => {
            log('debug', 'hidden command');
            await Promise.resolve();
        }, { label: 'Synchronizing', fields: () => ({ environment: 'staging' }) })());
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
    stream.on('data', (chunk: Buffer) => { output += chunk.toString(); });
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
    stream.on('data', (chunk: Buffer) => { output += chunk.toString(); });
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
