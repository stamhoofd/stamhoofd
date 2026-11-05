import { afterEach, expect, it, vi } from 'vitest';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { TerminalRenderer } from '@node/opentelemetry-terminal';
import { withLogSink } from '@common/opentelemetry-decorators';
import { RunVerbosity } from './command-runner.js';
import { withCliTelemetry } from './telemetry.js';

const mocks = vi.hoisted(() => ({ start: vi.fn(), shutdown: vi.fn(async () => {}), log: vi.fn() }));
vi.mock('@opentelemetry/sdk-node', () => ({ NodeSDK: vi.fn(class {
    start = mocks.start;
    shutdown = mocks.shutdown;
}) }));
vi.mock('@node/opentelemetry-terminal', () => ({ TerminalRenderer: vi.fn(class { log = mocks.log; }) }));
vi.mock('@common/opentelemetry-decorators', () => ({
    instrumentFunction: (_name: string, callback: () => unknown) => callback,
    withLogSink: vi.fn((_sink: unknown, callback: () => unknown) => callback()),
}));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

it.each([[RunVerbosity.Quiet, 'quiet'], [RunVerbosity.Command, 'normal'], [RunVerbosity.Output, 'verbose']] as const)('maps CLI verbosity %s to the terminal renderer', async (verbosity, expected) => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', '');
    vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', '');
    await expect(withCliTelemetry('test', verbosity, async () => 42)).resolves.toBe(42);
    expect(TerminalRenderer).toHaveBeenCalledWith({ verbosity: expected, groupBy: ['environment', 'vault'] });
    expect(NodeSDK).toHaveBeenCalledWith(expect.objectContaining({ serviceName: 'stam', spanProcessors: [expect.anything()] }));
    expect(withLogSink).toHaveBeenCalledWith(mocks.log, expect.any(Function));
    expect(mocks.start).toHaveBeenCalledOnce();
    expect(mocks.shutdown).toHaveBeenCalledOnce();
});

it('shuts down telemetry when the command fails', async () => {
    const error = new Error('Command failed');
    await expect(withCliTelemetry('test', RunVerbosity.Command, async () => { throw error; })).rejects.toBe(error);
    expect(mocks.shutdown).toHaveBeenCalledOnce();
});
