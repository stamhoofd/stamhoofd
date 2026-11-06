import { diagnosticKind, operationLabel } from '@common/opentelemetry-decorators';
import type { LogSink } from '@common/opentelemetry-decorators';
import { SpanStatusCode } from '@opentelemetry/api';
import type { Attributes } from '@opentelemetry/api';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace';
import { Terminal } from '@node/terminal';
import type { TerminalRegion } from '@node/terminal';
import chalk, { Chalk, chalkStderr } from 'chalk';
import type { ChalkInstance } from 'chalk';

/** Quiet shows warnings/errors; normal adds descriptive spans and info; verbose adds command spans and debug diagnostics. */
export type TerminalVerbosity = 'quiet' | 'normal' | 'verbose';

/** Presentation settings and ownership of the renderer's output destination. */
export type TerminalRendererOptions = {
    /** Defaults to normal. Filtering also determines log delivery acknowledgement. */
    verbosity?: TerminalVerbosity;
    /** String-valued span/log attributes used for headings, in this order. */
    groupBy?: string[];
    /** Force basic colors or disable them. NO_COLOR always disables renderer styling. */
    color?: boolean;
} & ({
    /** Shared application-owned coordinator. Shutdown disposes only this renderer's region. */
    terminal: Terminal;
    stream?: never;
} | {
    terminal?: never;
    /** Destination for an owned coordinator; defaults to process.stderr. */
    stream?: NodeJS.WriteStream;
});

type Operation = { label: string; progress?: string; command: boolean; group: string; depth: number; started: number };

/**
 * Renders labelled span lifetimes and scoped logs through a coordinated terminal.
 * @remarks Register with an application-owned SDK and pass {@link TerminalRenderer.log}
 * to `withLogSink`. This class does not initialize an SDK or export telemetry.
 * Only recording spans produce progress; unlabelled spans establish ancestry only.
 */
export class TerminalRenderer implements SpanProcessor {
    private readonly output: Terminal;
    private readonly region: TerminalRegion;
    private readonly colors: ChalkInstance;
    private readonly operations = new Map<string, Operation>();
    private readonly parents = new Map<string, string | undefined>();
    private group = '';
    private frame = 0;
    private timer?: ReturnType<typeof setInterval>;
    private outputLine?: string;
    private closed = false;

    /** Creates a renderer using either a shared terminal or an owned stream coordinator. */
    constructor(private readonly options: TerminalRendererOptions = {}) {
        this.output = options.terminal ?? new Terminal({ stdout: options.stream ?? process.stderr, stderr: process.stdout });
        const stream = this.output.stream;
        this.region = this.output.createRegion();
        this.colors = new Chalk({ level: options.color === false || process.env.NO_COLOR !== undefined
            ? 0
            : options.color === true
                ? 1
                : stream === process.stderr
                    ? chalkStderr.level
                    : stream === process.stdout ? chalk.level : stream.isTTY ? 1 : 0 });
    }

    private groupFor(fields: Attributes): string {
        // eslint-disable-next-line security/detect-object-injection -- Configured attribute names are read only for presentation.
        return (this.options.groupBy ?? []).map(key => fields[key]).filter(value => typeof value === 'string').join(' · ');
    }

    private heading(group: string): void {
        if (group && this.group !== group) {
            this.finishOutputLine();
            this.output.write(`\n${this.colors.bold(group)}\n`);
        }
        this.group = group;
    }

    /** Tracks ancestry and starts labelled progress. SDK notifications after shutdown are ignored. */
    onStart(span: Span): void {
        if (this.closed) return;
        const id = span.spanContext().spanId;
        this.parents.set(id, span.parentSpanContext?.spanId);
        // eslint-disable-next-line security/detect-object-injection -- operationLabel is a fixed library constant.
        const label = span.attributes[operationLabel];
        if (typeof label !== 'string' || this.options.verbosity === 'quiet') return;
        if (span.attributes['operation.label.kind'] === 'command' && this.options.verbosity !== 'verbose') return;
        let parent = span.parentSpanContext?.spanId;
        while (parent && !this.operations.has(parent)) parent = this.parents.get(parent);
        const group = this.groupFor(span.attributes);
        const depth = parent ? this.operations.get(parent)!.depth + 1 : group ? 1 : 0;
        const operation = { label, command: span.attributes['operation.label.kind'] === 'command', group, depth, started: performance.now() };
        this.operations.set(id, operation);
        this.heading(group);
        if (!this.output.isTTY) {
            this.finishOutputLine();
            this.output.write(`${'  '.repeat(depth)}${this.label(operation)}...\n`);
        }
        this.render();
        if (this.output.isTTY && !this.timer) this.timer = setInterval(() => this.render(), 80);
    }

    /** Prints the original operation label, failure/success marker and SDK-measured duration. */
    onEnd(span: ReadableSpan): void {
        if (this.closed) return;
        const id = span.spanContext().spanId;
        const operation = this.operations.get(id);
        this.parents.delete(id);
        if (!operation) return;
        this.operations.delete(id);
        this.finishOutputLine();
        this.region.update('');
        this.heading(operation.group);
        const seconds = span.duration[0] + span.duration[1] / 1e9;
        const symbol = span.status.code === SpanStatusCode.ERROR ? this.colors.red('✗') : this.colors.green('✓');
        const summary = span.attributes['operation.summary'];
        this.output.write(`${'  '.repeat(operation.depth)}${symbol} ${this.label(operation)}${typeof summary === 'string' ? ` — ${summary}` : ''} ${this.colors.dim(`— ${seconds.toFixed(1)}s`)}\n`);
        this.render();
    }

    /**
     * Bound sink suitable for `withLogSink(renderer.log, callback)`.
     * @returns True when presented outside a suspended prompt; filtered messages
     * are unacknowledged, and calls after shutdown return false.
     * @remarks Progress attributes update live detail without replacing the original
     * label. Redirected progress is printed as ordinary log lines. Subprocess output
     * preserves split lines and uses gutters unless its style is plain.
     */
    readonly log: LogSink = (level, message, fields) => {
        if (this.closed) return false;
        const verbosity = this.options.verbosity ?? 'normal';
        if (verbosity === 'quiet' && level !== 'warn' && level !== 'error') return;
        if (level === 'debug' && verbosity !== 'verbose') return;
        if (fields['operation.progress'] === true && typeof fields.span_id === 'string') {
            const operation = this.operations.get(fields.span_id);
            if (operation && this.output.isTTY) {
                operation.progress = message;
                this.render();
                return !this.output.isSuspended;
            }
            if (fields['operation.progress.liveOnly'] === true) return true;
        }
        // eslint-disable-next-line security/detect-object-injection -- diagnosticKind is a fixed library constant.
        const kind = fields[diagnosticKind];
        this.heading(this.groupFor(fields));
        const indent = '  '.repeat(this.diagnosticDepth(fields));
        if (kind === 'stdout' || kind === 'stderr') {
            const source = `${typeof fields.span_id === 'string' ? fields.span_id : ''}:${kind}`;
            if (this.outputLine && this.outputLine !== source) this.finishOutputLine();
            const lines = message.split('\n');
            for (const [index, line] of lines.entries()) {
                const newline = index < lines.length - 1;
                if (!line && !newline) continue;
                if (!this.outputLine && fields['diagnostic.output.style'] !== 'plain') {
                    const marker = kind === 'stderr' ? this.colors.yellow('│ stderr: ') : this.colors.dim('│ ');
                    this.output.write(`${indent}${marker}`);
                }
                this.output.write(line + (newline ? '\n' : ''));
                this.outputLine = newline ? undefined : source;
            }
            return !this.output.isSuspended;
        }
        this.finishOutputLine();
        if (kind === 'command') this.output.write(`${indent}${this.colors.dim(`$ ${message}`)}\n`);
        else {
            const prefix = level === 'warn' ? this.colors.yellow('Warning: ') : level === 'error' ? this.colors.red('Error: ') : '';
            this.output.write(`${prefix}${message}\n`);
        }
        return !this.output.isSuspended;
    };

    private diagnosticDepth(fields: Attributes): number {
        let id = typeof fields.span_id === 'string' ? fields.span_id : undefined;
        while (id) {
            const operation = this.operations.get(id);
            if (operation) return operation.depth + 1;
            id = this.parents.get(id);
        }
        return this.groupFor(fields) ? 2 : 1;
    }

    private finishOutputLine(): void {
        if (this.outputLine) this.output.write('\n');
        this.outputLine = undefined;
    }

    private render(): void {
        try {
            this.renderProgress();
        } catch {
            if (this.timer) clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    private renderProgress(): void {
        if (!this.operations.size) {
            this.region.update('');
            if (this.timer) clearInterval(this.timer);
            this.timer = undefined;
            return;
        }
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.region.update([...this.operations.values()].map(operation => `${'  '.repeat(operation.depth)}${this.colors.cyan(frames[this.frame % frames.length])} ${this.label(operation)}${operation.progress ? ` — ${operation.progress}` : ''} ${this.colors.dim(`— ${((performance.now() - operation.started) / 1000).toFixed(1)}s`)}`).join('\n'));
        this.frame++;
    }

    private label(operation: Operation): string {
        return operation.command ? this.colors.dim(operation.label) : operation.label;
    }

    /**
     * Runs an interactive callback while ordinary diagnostics are buffered.
     * @param label - Already-redacted command or description for the static marker.
     * @param callback - Interaction using the supplied writer for prompt output.
     * @returns The callback's result; application failures propagate unchanged.
     * @remarks Successful short interactions collapse to a completion line; failures
     * retain output. Quiet mode omits markers. After shutdown the callback still
     * executes, but its writer returns false and no terminal output is produced.
     */
    async withInteractiveOperation<T>(label: string, callback: (write: (text: string) => boolean) => Promise<T>): Promise<T> {
        if (this.closed) return callback(() => false);
        if (this.options.verbosity === 'quiet') {
            return this.output.withPrompt(callback);
        }
        const text = this.colors.dim(label);
        return this.output.withTransientOutput(`${this.colors.yellow('?')} ${text}`, callback,
            success => `${success ? this.colors.green('✓') : this.colors.red('✗')} ${text}`);
    }

    /** No-op: rendering is synchronous; prompt buffering belongs to the shared terminal. */
    async forceFlush(): Promise<void> {}

    /**
     * Stops animation, terminates partial output and disposes owned resources once.
     * @remarks Shared terminals remain application-owned. Cleanup is attempted even
     * when output fails; the failure rejects this call. Later calls are no-ops and
     * late span notifications/logs cannot restart rendering.
     */
    async shutdown(): Promise<void> {
        if (this.closed) return;
        this.closed = true;
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
        this.operations.clear();
        this.parents.clear();
        try {
            this.finishOutputLine();
        } finally {
            this.outputLine = undefined;
            try {
                this.region.dispose();
            } finally {
                if (!this.options.terminal) this.output.dispose();
            }
        }
    }
}
