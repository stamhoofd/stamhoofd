import { PassThrough } from 'node:stream';
import { expect, it } from 'vitest';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { instrumentFunction, log, withLogSink } from '@common/opentelemetry-decorators';
import { TerminalRenderer } from './terminal.js';

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
