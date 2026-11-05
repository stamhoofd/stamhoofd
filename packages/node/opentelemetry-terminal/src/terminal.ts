import { diagnosticKind, operationLabel } from '@common/opentelemetry-decorators';
import type { LogSink } from '@common/opentelemetry-decorators';
import { SpanStatusCode } from '@opentelemetry/api';
import type { Attributes } from '@opentelemetry/api';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace';
import { StdSync } from '@stamhoofd/stdsync';

export type TerminalVerbosity = 'quiet' | 'normal' | 'verbose';
type Operation = { label: string; group: string; depth: number; started: number };

/** An application-owned span processor and scoped log sink. Never registers an SDK. */
export class TerminalRenderer implements SpanProcessor {
    private readonly output: StdSync;
    private readonly operations = new Map<string, Operation>();
    private readonly parents = new Map<string, string | undefined>();
    private group = '';
    private frame = 0;
    private timer?: ReturnType<typeof setInterval>;

    constructor(private readonly options: { verbosity?: TerminalVerbosity; groupBy?: string[]; stream?: NodeJS.WriteStream } = {}) {
        this.output = new StdSync({ stdout: options.stream ?? process.stderr, stderr: process.stdout });
    }

    private groupFor(fields: Attributes): string {
        return (this.options.groupBy ?? []).map(key => fields[key]).filter(value => typeof value === 'string').join(' · ');
    }

    private heading(group: string): void {
        if (group && this.group !== group) this.output.write(`\n${group}\n`);
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
        if (!this.output.isTTY) this.output.write(`${'  '.repeat(depth)}${label}...\n`);
        this.render();
        if (this.output.isTTY && !this.timer) this.timer = setInterval(() => this.render(), 80);
    }

    onEnd(span: ReadableSpan): void {
        const id = span.spanContext().spanId;
        const operation = this.operations.get(id);
        this.parents.delete(id);
        if (!operation) return;
        this.operations.delete(id);
        this.output.clearLive();
        this.heading(operation.group);
        const seconds = span.duration[0] + span.duration[1] / 1e9;
        this.output.write(`${'  '.repeat(operation.depth)}${span.status.code === SpanStatusCode.ERROR ? '✗' : '✓'} ${operation.label} — ${seconds.toFixed(1)}s\n`);
        this.render();
    }

    readonly log: LogSink = (level, message, fields) => {
        const verbosity = this.options.verbosity ?? 'normal';
        if (verbosity === 'quiet' && level !== 'warn' && level !== 'error') return;
        if (level === 'debug' && verbosity !== 'verbose') return;
        const kind = fields[diagnosticKind];
        this.heading(this.groupFor(fields));
        if (kind === 'stdout' || kind === 'stderr') {
            this.output.write(message);
            return;
        }
        this.output.write(`${kind === 'command' ? '  $ ' : level === 'warn' ? 'Warning: ' : level === 'error' ? 'Error: ' : ''}${message}\n`);
    };

    private render(): void {
        if (!this.operations.size) {
            this.output.clearLive();
            if (this.timer) clearInterval(this.timer);
            this.timer = undefined;
            return;
        }
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.output.setLive([...this.operations.values()].map(operation => `${'  '.repeat(operation.depth)}${frames[this.frame % frames.length]} ${operation.label} — ${((performance.now() - operation.started) / 1000).toFixed(1)}s`).join('\n'));
        this.frame++;
    }

    async forceFlush(): Promise<void> {}

    async shutdown(): Promise<void> {
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
        this.output.clearLive();
        this.operations.clear();
        this.parents.clear();
    }
}
