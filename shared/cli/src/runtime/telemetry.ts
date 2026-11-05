import { instrumentFunction, withLogSink } from '@common/opentelemetry-decorators';
import { TerminalRenderer } from '@node/opentelemetry-terminal';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { RunVerbosity } from './command-runner.js';

/** Own the SDK lifecycle at the command boundary. No remote export unless explicitly configured. */
export async function withCliTelemetry<T>(name: string, verbosity: RunVerbosity, callback: () => Promise<T>): Promise<T> {
    const terminal = new TerminalRenderer({
        verbosity: verbosity === RunVerbosity.Quiet ? 'quiet' : verbosity === RunVerbosity.Output ? 'verbose' : 'normal',
        groupBy: ['environment', 'vault'],
    });
    const sdk = new NodeSDK({
        serviceName: 'stam',
        autoDetectResources: false,
        logRecordProcessors: [],
        metricReaders: [],
        spanProcessors: [terminal, ...(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
            ? [new BatchSpanProcessor({ exporter: new OTLPTraceExporter() })]
            : [])],
    });
    sdk.start();
    try {
        return await withLogSink(terminal.log, () => instrumentFunction(name, callback)());
    } finally {
        await sdk.shutdown();
    }
}
