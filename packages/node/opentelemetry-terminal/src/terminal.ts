import { diagnosticKind, operationLabel } from '@common/opentelemetry-decorators';
import type { LogSink } from '@common/opentelemetry-decorators';
import { SpanStatusCode } from '@opentelemetry/api';
import type { Attributes } from '@opentelemetry/api';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace';
import { StdSync } from '@stamhoofd/stdsync';
import chalk, { Chalk, chalkStderr } from 'chalk';
import type { ChalkInstance } from 'chalk';

export type TerminalVerbosity = 'quiet' | 'normal' | 'verbose';
type Operation = { label: string; group: string; depth: number; started: number };

/** An application-owned span processor and scoped log sink. Never registers an SDK. */
export class TerminalRenderer implements SpanProcessor {
    private readonly output: StdSync;
    private readonly colors: ChalkInstance;
    private readonly operations = new Map<string, Operation>();
    private readonly parents = new Map<string, string | undefined>();
    private group = '';
    private frame = 0;
    private timer?: ReturnType<typeof setInterval>;
    private outputLine?: string;

    constructor(private readonly options: { verbosity?: TerminalVerbosity; groupBy?: string[]; stream?: NodeJS.WriteStream; color?: boolean } = {}) {
        const stream = options.stream ?? process.stderr;
        this.output = new StdSync({ stdout: stream, stderr: process.stdout });
        this.colors = new Chalk({ level: options.color === false || process.env.NO_COLOR !== undefined
            ? 0
            : options.color === true
                ? 1
                : stream === process.stderr
                    ? chalkStderr.level
                    : stream === process.stdout ? chalk.level : stream.isTTY ? 1 : 0 });
    }

    private groupFor(fields: Attributes): string {
        return (this.options.groupBy ?? []).map(key => fields[key]).filter(value => typeof value === 'string').join(' · ');
    }

    private heading(group: string): void {
        if (group && this.group !== group) {
            this.finishOutputLine();
            this.output.write(`\n${this.colors.bold(group)}\n`);
        }
        this.group = group;
    }

    onStart(span: Span): void {
        const id = span.spanContext().spanId;
        this.parents.set(id, span.parentSpanContext?.spanId);
        const label = span.attributes[operationLabel];
        if (typeof label !== 'string' || this.options.verbosity === 'quiet') return;
        let parent = span.parentSpanContext?.spanId;
        while (parent && !this.operations.has(parent)) parent = this.parents.get(parent);
        const group = this.groupFor(span.attributes);
        const depth = parent ? this.operations.get(parent)!.depth + 1 : group ? 1 : 0;
        const operation = { label, group, depth, started: performance.now() };
        this.operations.set(id, operation);
        this.heading(group);
        if (!this.output.isTTY) {
            this.finishOutputLine();
            this.output.write(`${'  '.repeat(depth)}${label}...\n`);
        }
        this.render();
        if (this.output.isTTY && !this.timer) this.timer = setInterval(() => this.render(), 80);
    }

    onEnd(span: ReadableSpan): void {
        const id = span.spanContext().spanId;
        const operation = this.operations.get(id);
        this.parents.delete(id);
        if (!operation) return;
        this.operations.delete(id);
        this.finishOutputLine();
        this.output.clearLive();
        this.heading(operation.group);
        const seconds = span.duration[0] + span.duration[1] / 1e9;
        const symbol = span.status.code === SpanStatusCode.ERROR ? this.colors.red('✗') : this.colors.green('✓');
        this.output.write(`${'  '.repeat(operation.depth)}${symbol} ${operation.label} ${this.colors.dim(`— ${seconds.toFixed(1)}s`)}\n`);
        this.render();
    }

    readonly log: LogSink = (level, message, fields) => {
        const verbosity = this.options.verbosity ?? 'normal';
        if (verbosity === 'quiet' && level !== 'warn' && level !== 'error') return;
        if (level === 'debug' && verbosity !== 'verbose') return;
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
                if (!this.outputLine) {
                    const marker = kind === 'stderr' ? this.colors.yellow('│ stderr: ') : this.colors.dim('│ ');
                    this.output.write(`${indent}${marker}`);
                }
                this.output.write(line + (newline ? '\n' : ''));
                this.outputLine = newline ? undefined : source;
            }
            return;
        }
        this.finishOutputLine();
        if (kind === 'command') this.output.write(`${indent}${this.colors.dim(`$ ${message}`)}\n`);
        else {
            const prefix = level === 'warn' ? this.colors.yellow('Warning: ') : level === 'error' ? this.colors.red('Error: ') : '';
            this.output.write(`${prefix}${message}\n`);
        }
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
        if (!this.operations.size) {
            this.output.clearLive();
            if (this.timer) clearInterval(this.timer);
            this.timer = undefined;
            return;
        }
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.output.setLive([...this.operations.values()].map(operation => `${'  '.repeat(operation.depth)}${this.colors.cyan(frames[this.frame % frames.length])} ${operation.label} ${this.colors.dim(`— ${((performance.now() - operation.started) / 1000).toFixed(1)}s`)}`).join('\n'));
        this.frame++;
    }

    async forceFlush(): Promise<void> {}

    async shutdown(): Promise<void> {
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
        this.finishOutputLine();
        this.output.clearLive();
        this.operations.clear();
        this.parents.clear();
    }
}
