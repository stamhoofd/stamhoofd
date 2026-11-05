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
    let sdk: NodeSDK | undefined;
    const warn = () => {
        try { process.stderr.write('Warning: telemetry unavailable; command result preserved.\n'); } catch { /* The output destination may itself have failed. */ }
    };
    try {
        sdk = new NodeSDK({
            serviceName: 'stam',
            autoDetectResources: false,
            logRecordProcessors: [],
            metricReaders: [],
            spanProcessors: [terminal, ...(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
                ? [new BatchSpanProcessor({ exporter: new OTLPTraceExporter() })]
                : [])],
        });
        sdk.start();
    } catch { warn(); }
    try {
        return await withLogSink(terminal.log, () => instrumentFunction(name, callback)());
    } finally {
        // Restore the terminal before waiting for a potentially unavailable exporter.
        try { await terminal.shutdown(); } catch { warn(); }
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
            await Promise.race([
                Promise.resolve().then(() => sdk?.shutdown()),
                new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error('Telemetry shutdown deadline')), 2000); }),
            ]);
        } catch { warn(); } finally { if (timeout) clearTimeout(timeout); }
    }
}
