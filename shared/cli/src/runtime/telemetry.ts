import { instrumentFunction, withLogSink } from '@common/opentelemetry-decorators';
import { TerminalRenderer } from '@node/opentelemetry-terminal';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { AlwaysOnSampler, BatchSpanProcessor } from '@opentelemetry/sdk-trace';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { RunVerbosity } from './verbosity.js';
import { Terminal } from '@node/terminal';
import { AsyncLocalStorage } from 'node:async_hooks';

const invocation = new AsyncLocalStorage<{ terminal: Terminal; renderer?: TerminalRenderer; signal: AbortSignal }>();

/** Shared by nested commands, workflows, prompts and subprocesses in one invocation. */
export function getCliTelemetry() { return invocation.getStore(); }

/** Cleanup must still run after cancellation; a subsequent interrupt can cancel cleanup itself. */
export async function withCliCleanup<T>(callback: () => Promise<T>): Promise<T> {
    const runtime = invocation.getStore();
    if (!runtime?.signal.aborted) return callback();
    const controller = new AbortController();
    const abort = () => controller.abort();
    process.on('SIGINT', abort);
    process.on('SIGTERM', abort);
    try {
        return await invocation.run({ ...runtime, signal: controller.signal }, callback);
    } finally {
        process.off('SIGINT', abort);
        process.off('SIGTERM', abort);
    }
}

export async function withCliPrompt<T>(callback: () => Promise<T>): Promise<T> {
    const runtime = invocation.getStore();
    runtime?.signal.throwIfAborted();
    return runtime ? runtime.terminal.withPrompt(callback) : callback();
}

export async function withCliInteractiveOperation<T>(label: string, callback: (write: (text: string) => boolean) => Promise<T>): Promise<T> {
    const runtime = invocation.getStore();
    runtime?.signal.throwIfAborted();
    return runtime?.renderer
        ? runtime.renderer.withInteractiveOperation(label, callback)
        : withCliPrompt(() => callback((text) => { process.stderr.write(text); return true; }));
}

/** Own the SDK lifecycle at the command boundary. No remote export unless explicitly configured. */
export async function withCliTelemetry<T>(name: string, verbosity: RunVerbosity, callback: () => Promise<T>): Promise<T> {
    if (invocation.getStore()) return instrumentFunction(name, callback)();
    const output = new Terminal({ stdout: process.stderr, stderr: process.stdout });
    const controller = new AbortController();
    const abort = () => controller.abort();
    process.on('SIGINT', abort);
    process.on('SIGTERM', abort);
    let terminal: TerminalRenderer | undefined;
    let sdk: NodeSDK | undefined;
    let warned = false;
    const warn = () => {
        if (warned) return;
        warned = true;
        try { process.stderr.write('Warning: telemetry unavailable; command result preserved.\n'); } catch { /* The output destination may itself have failed. */ }
    };
    try {
        terminal = new TerminalRenderer({
            terminal: output,
            verbosity: verbosity === RunVerbosity.Quiet ? 'quiet' : verbosity === RunVerbosity.Output ? 'verbose' : 'normal',
            groupBy: ['environment', 'vault'],
        });
        sdk = new NodeSDK({
            serviceName: 'stam',
            autoDetectResources: false,
            sampler: new AlwaysOnSampler(),
            logRecordProcessors: [],
            metricReaders: [],
            spanProcessors: [terminal, ...(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
                ? [new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ timeoutMillis: 1500 }) })]
                : [])],
        });
        sdk.start();
    } catch { warn(); }
    try {
        return await invocation.run({ terminal: output, renderer: terminal, signal: controller.signal }, () => withLogSink(terminal?.log ?? (() => false), () => instrumentFunction(name, callback)()));
    } finally {
        process.off('SIGINT', abort);
        process.off('SIGTERM', abort);
        // Restore the terminal before waiting for a potentially unavailable exporter.
        try { await terminal?.shutdown(); } catch { warn(); }
        try { output.dispose(); } catch { warn(); }
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
            await Promise.race([
                Promise.resolve().then(() => sdk?.shutdown()),
                new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error('Telemetry shutdown deadline')), 2000); }),
            ]);
        } catch { warn(); } finally { if (timeout) clearTimeout(timeout); }
    }
}
