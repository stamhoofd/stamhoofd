import { subscribeDevSpans, type DevSpan } from '@node/dev-tools/spans';
import { Chalk, type ChalkInstance } from 'chalk';
import { stripVTControlCharacters } from 'node:util';
import { SpanStatusCode } from '@opentelemetry/api';
export const traceDetails = ['summary', 'compact', 'full'] as const;
export type TraceDetail = (typeof traceDetails)[number];
type TraceViewOptions = { detail?: TraceDetail; quiet?: boolean; tty?: boolean; columns?: number };

const outcomes = new Map<number, string>([
    [SpanStatusCode.ERROR, 'failed'],
    [SpanStatusCode.OK, 'ok'],
]);

function problem(span: DevSpan) {
    if (outcomes.get(span.code) === 'failed' || (span.status ?? 0) >= 500) return 'failed';
    if ((span.status ?? 0) >= 400) return 'warning';
}

const operationLabels: Record<string, string> = {
    'auth.authenticate': 'Authenticate bearer',
    'organization.resolve_scope': 'Resolve organization scope',
    'organization.assemble': 'Assemble organizations',
    'organization.period_groups': 'Load periods and groups',
    'organization.webshop_previews': 'Load webshop previews',
    'http.client.renderer': 'Call renderer',
    'mysql.acquire': 'MySQL pool checkout',
    'queue.wait': 'Queue wait',
    'queue.execute': 'Queue execution',
    'pdf.render': 'Render PDF',
    'invoice.upload': 'Upload invoice',
    'invoice.persist': 'Save invoice',
    'storage.put': 'Write to storage',
    'statistics.cycle': 'Statistics cycle',
    'statistics.incremental': 'Sync statistics changes',
    'statistics.deletes': 'Sync statistics deletions',
    'statistics.settle': 'Settle statistics periods',
};

function operation(span: DevSpan) {
    if (span.name === 'http.server.request')
        return `${span.method ?? 'HTTP'} ${span.route ?? span.endpoint ?? '(route not recorded)'}`;
    if (span.name === 'mysql.execute')
        return [
            'SQL',
            (span.operation ?? 'statement').toUpperCase(),
            span.collections?.join(', ') ?? span.collection,
        ]
            .filter(Boolean)
            .join(' ');
    return operationLabels[span.name] ?? span.name;
}

function duration(span: DevSpan) {
    return span.durationMs > 0 && span.durationMs < 0.1
        ? '<0.1 ms'
        : `${Number(span.durationMs.toFixed(1))} ms`;
}

function detail(span: DevSpan, colors: ChalkInstance) {
    const severity = problem(span);
    const reason =
        span.reason === 'http_status'
            ? 'HTTP status'
            : span.reason === 'transport' &&
                span.name === 'http.client.renderer' &&
                span.status === 200
              ? 'transfer after HTTP 200'
              : span.reason;
    const status = [
        severity,
        span.status && `HTTP ${span.status}`,
        reason,
        span.retry !== undefined && `retry ${span.retry}`,
    ]
        .filter(Boolean)
        .join('  ');
    if (severity === 'failed') return colors.red(status);
    if (severity) return colors.yellow(status);
    return colors.green(status);
}

/** One substantial direct child, then its substantial nested child or a second sibling. */
function timingClues(root: DevSpan, trace: DevSpan[]) {
    const ranked = trace
        .filter((s) => s.durationMs >= Math.max(10, root.durationMs * 0.2))
        .sort((a, b) => b.durationMs - a.durationMs || a.startMs - b.startMs);
    const [first, sibling] = ranked.filter((s) => s.parentId === root.spanId);
    if (!first) return [];
    const nested = ranked.find((s) => s.parentId === first.spanId);
    const second = nested ?? sibling;
    return second ? [first, second] : [first];
}

// Protocol labels and tree guides occupy one terminal cell per character; Chalk codes occupy none.
function pad(text: string, width: number, right = false) {
    const spaces = ' '.repeat(Math.max(0, width - stripVTControlCharacters(text).length));
    return right ? spaces + text : text + spaces;
}

function formatTree(
    trace: DevSpan[],
    mode: TraceDetail,
    quiet: boolean,
    final: boolean,
    truncated: boolean,
    colors: ChalkInstance,
    columns: number,
) {
    const ordered = [...trace].sort(
        (a, b) => a.startMs - b.startMs || a.spanId.localeCompare(b.spanId),
    );
    const byId = new Map(ordered.map((s) => [s.spanId, s]));
    const root = ordered.find((s) => !s.parentId);
    const first = root ?? ordered[0];
    const id = colors.dim(`#${first.traceId.slice(-8)}`);
    const time = new Date(first.startMs);
    const timestamp = colors.dim(
        Number.isNaN(time.getTime()) ? '--:--:--' : time.toISOString().slice(11, 23) + 'Z',
    );
    const full = mode === 'full';
    const visible = new Set<DevSpan>();
    const showBranch = (s: DevSpan) => {
        let current: DevSpan | undefined = s;
        while (current && !visible.has(current)) {
            visible.add(current);
            current = current.parentId ? byId.get(current.parentId) : undefined;
        }
    };
    const problems = ordered.filter((s) => problem(s));
    for (const span of problems) showBranch(span);
    const healthy = !problems.length;
    if (mode === 'compact') {
        for (const span of ordered) if ((span.retry ?? 0) > 0) showBranch(span);
    }
    const orphans = ordered.filter((s) => s.parentId && !byId.has(s.parentId));
    const partial = [
        truncated && 'span limit omitted additional spans',
        orphans.length && 'parent not recorded',
        !root && !orphans.length && 'cyclic ancestry',
    ]
        .filter(Boolean)
        .join('; ');
    const notice = partial ? colors.yellow(`partial: ${partial}`) : '';
    if (quiet && healthy) return truncated ? `${timestamp} ${id} ${notice}` : '';
    if (mode === 'summary' || (!full && !visible.size)) {
        const preflight =
            root?.method === 'OPTIONS' &&
            root.status !== undefined &&
            root.status >= 200 &&
            root.status < 300;
        if ((!root && healthy) || (preflight && healthy)) {
            return notice && (truncated || final) ? `${timestamp} ${id} ${notice}` : '';
        }
        if (mode === 'compact' && root) {
            visible.add(root);
            for (const span of timingClues(root, ordered)) visible.add(span);
        }
    }
    if (mode === 'summary') {
        const failures = problems.filter((s) => problem(s) === 'failed');
        const candidates = failures.length ? failures : problems;
        // Prefer the failing leaf over its enclosing stage, even when the processes' clocks differ.
        const failure =
            candidates.find(
                (s) =>
                    s.reason &&
                    !ordered.some((child) => child.parentId === s.spanId && visible.has(child)),
            ) ??
            candidates.find((s) => s.reason) ??
            candidates[0];
        return [
            timestamp,
            pad(colors.cyan(first.service), 8),
            pad(operation(first), 17),
            pad(detail(first, colors) || 'completed', 9),
            pad(duration(first), 7, true),
            failure && failure !== first && `${operation(failure)}  ${detail(failure, colors)}`,
            id,
            notice,
        ]
            .filter(Boolean)
            .join('  ');
    }
    // A successful renderer branch explains a post-render upload failure only if unambiguous.
    if (mode === 'compact' && ordered.some((s) => s.name === 'invoice.upload' && problem(s))) {
        const renders = ordered.filter((s) => s.name === 'pdf.render');
        if (renders.length === 1 && !problem(renders[0])) {
            const server = byId.get(renders[0].parentId ?? '');
            const client = byId.get(server?.parentId ?? '');
            if (
                server?.service === 'renderer' &&
                client?.name === 'http.client.renderer' &&
                client.status === 200 &&
                !problem(client)
            )
                showBranch(renders[0]);
        }
    }
    const nodes = ordered.filter((s) => full || visible.has(s));
    const rows = [['Operation', 'Status / detail', 'Duration']];
    const timings: ({ start: number; end: number } | undefined)[] = [];
    const seen = new Set<string>();
    function append(
        span: DevSpan,
        prefix: string,
        last: boolean,
        linked: boolean,
        parent?: DevSpan,
    ) {
        if (seen.has(span.spanId)) return;
        seen.add(span.spanId);
        const boundary =
            parent?.service !== span.service
                ? colors.cyan(parent ? `→ ${span.service}` : span.service)
                : '';
        const label = [boundary, operation(span)].filter(Boolean).join('  ');
        const start = root && linked ? span.startMs - root.startMs : NaN;
        const end = start + span.durationMs;
        timings.push(root && start >= 0 && end <= root.durationMs ? { start, end } : undefined);
        rows.push([
            `${prefix}${last ? '└─' : '├─'} ${label}`,
            detail(span, colors),
            duration(span),
        ]);
        const children = nodes.filter((s) => s.parentId === span.spanId);
        children.forEach((s, i) =>
            append(s, prefix + (last ? '   ' : '│  '), i === children.length - 1, linked, span),
        );
    }
    const roots = nodes.filter((s) => !s.parentId || !byId.has(s.parentId));
    roots.forEach((s, i) => append(s, '', i === roots.length - 1, s === root));
    for (const s of nodes) if (!seen.has(s.spanId)) append(s, '', true, false);
    const widths = rows[0].map((_, col) =>
        Math.max(...rows.map((row) => stripVTControlCharacters(row[col]).length)),
    );
    const cells = Math.min(36, columns - widths.reduce((a, b) => a + b, 0) - 6);
    function waterfall(index: number) {
        if (!root || cells < 10) return '';
        if (!index) return colors.dim('  Timeline');
        const timing = timings[index - 1];
        if (!timing) return '  —';
        const extent = root.durationMs;
        const coordinate = (t: number) => (extent ? Math.round((t / extent) * cells) : 0);
        const from = coordinate(timing.start),
            to = coordinate(timing.end);
        const start = Math.min(cells - 1, from);
        const tiny = !extent || ((timing.end - timing.start) / extent) * cells < 1;
        const bar = tiny ? '▏' : '━'.repeat(to - from);
        return '  ' + ' '.repeat(start) + colors.cyan(bar);
    }
    return [
        [timestamp, id, notice].filter(Boolean).join('  '),
        ...rows.map(
            (row, i) =>
                row
                    .map((text, col) =>
                        col >= 2
                            ? colors.dim(pad(text, widths[col], true))
                            : pad(text, widths[col]),
                    )
                    .join('  ') + waterfall(i),
        ),
    ].join('\n');
}

/** Writes each changed snapshot as one diagnostic block; shutdown also flushes late children. */
export function startDevTraceView(
    session: string,
    write: (block: string) => void,
    {
        detail: mode = 'compact',
        quiet = false,
        tty = !!process.stderr.isTTY,
        columns,
    }: TraceViewOptions = {},
) {
    const colors = new Chalk({
        level: tty && process.env.NO_COLOR === undefined && process.env.TERM !== 'dumb' ? 1 : 0,
    });
    const rendered = new Map<string, { last: DevSpan; block: string; truncated: boolean }>();
    function render(trace: DevSpan[], truncated: boolean, final: boolean) {
        const last = trace[trace.length - 1];
        const previous = rendered.get(last.traceId);
        if (
            previous?.last === last &&
            previous.truncated === truncated &&
            (!final || previous.block)
        )
            return;
        const block = formatTree(
            trace,
            mode,
            quiet,
            final,
            truncated,
            colors,
            columns ?? process.stderr.columns ?? 100,
        );
        if (block && block !== previous?.block) write(`\n${block}\n`);
        rendered.set(last.traceId, { last, block, truncated });
    }
    const subscriber = subscribeDevSpans(session, (trace, truncated) => {
        render(trace, truncated, true);
        rendered.delete(trace[0].traceId);
    });
    function refresh(final = false) {
        for (const trace of subscriber.snapshot()) {
            render(trace, subscriber.isTruncated(trace[0].traceId), final);
        }
    }
    const timer = setInterval(refresh, 250).unref();
    return () => {
        clearInterval(timer);
        try {
            refresh(true);
        } finally {
            subscriber.close();
            rendered.clear();
        }
    };
}
