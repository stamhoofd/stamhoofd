import { PassThrough } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { stripVTControlCharacters } from 'node:util';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { instrumentFunction, log, withLogSink } from '@common/opentelemetry-decorators';
import { TerminalRenderer } from './terminal.js';

afterEach(() => vi.unstubAllEnvs());

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
    await renderer.shutdown();
    expect(output).toContain('staging');
    expect(output).toContain('Error: Failed');
    expect(output).not.toContain('\x1b');
});
