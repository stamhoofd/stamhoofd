import { stripVTControlCharacters } from 'node:util';
import { channel } from 'node:diagnostics_channel';
import { maxDevTraceSpans, type DevSpan } from '@node/dev-tools/spans';
import { createDevEmitter } from '@node/dev-tools/events';
import { afterEach, expect, it, vi } from 'vitest';
import { startDevTraceView } from './dev-trace-view.js';
import { DevTarget, openDevSession } from '../workflows/start-dev.js';

const root: DevSpan = {
    service: 'api',
    name: 'http.server.request',
    kind: 1,
    method: 'PATCH',
    route: '/invoices',
    traceId: 'a'.repeat(32),
    spanId: '1'.repeat(16),
    startMs: 10,
    durationMs: 45,
    code: 2,
    status: 502,
};
const client: DevSpan = {
    ...root,
    spanId: '2'.repeat(16),
    parentId: root.spanId,
    name: 'http.client.renderer',
    kind: 2,
    startMs: 20,
    durationMs: 30,
};
const server: DevSpan = {
    ...root,
    spanId: '3'.repeat(16),
    parentId: client.spanId,
    service: 'renderer',
    method: 'POST',
    route: '/html-to-pdf',
    startMs: 21,
    durationMs: 27,
    status: undefined,
};
function send(span: DevSpan) {
    channel('stamhoofd.dev.session.span').publish({ session: 'view-test', span });
}

it.each([client.spanId, root.spanId])(
    'uses the entire root interval for retained compact rows (parent %s)',
    (parentId) => {
        const render = (detail?: 'full') => {
            const write = vi.fn();
            const stop = startDevTraceView('view-test', write, {
                detail,
                columns: 160,
                tty: false,
            });
            send({ ...server, code: 0, parentId, startMs: 40, durationMs: 20 });
            send({ ...client, code: 0, status: 200, startMs: 35, durationMs: 35 });
            send({
                ...client,
                name: 'queue.wait',
                spanId: '4'.repeat(16),
                code: 0,
                status: undefined,
                startMs: 85,
                durationMs: 5,
            });
            send({ ...root, code: 0, status: 200, durationMs: 100 });
            stop();
            return write.mock.calls[0][0] as string;
        };
        const compact = render(),
            full = render('full');
        expect(compact).not.toContain('Queue wait');
        expect(full).toContain('Queue wait');
        for (const block of [compact, full]) {
            const line = (label: string) => block.split('\n').find((l) => l.includes(label))!;
            const origin = line('Timeline').indexOf('Timeline');
            expect(line('PATCH /invoices').slice(origin)).toBe('━'.repeat(36));
            expect(line('Call renderer').slice(origin)).toBe(' '.repeat(9) + '━'.repeat(13));
            expect(line('POST /html-to-pdf').slice(origin)).toBe(' '.repeat(11) + '━'.repeat(7));
        }
    },
);

it.each(['summary', 'compact', 'full'] as const)(
    'filters routine OPTIONS without hiding problems (%s)',
    (mode) => {
        const write = vi.fn();
        const stop = startDevTraceView('view-test', write, { detail: mode });
        send({ ...root, method: 'OPTIONS', status: 204, code: 0 });
        send({ ...root, traceId: 'c'.repeat(32), method: 'OPTIONS' });
        stop();
        expect(write.mock.calls.flat().join('')).toContain('OPTIONS /invoices');
        expect(write.mock.calls.flat().join('')).toContain('failed  HTTP 502');
        expect(write.mock.calls.flat().join('').includes('HTTP 204')).toBe(mode === 'full');
    },
);

it.each([
    [40, 9.9, false],
    [60, 11.9, false],
    [50, 10, true],
])(
    'compact on a %d ms root includes a %d ms clue only above both thresholds',
    (total, child, shown) => {
        const write = vi.fn();
        const stop = startDevTraceView('view-test', write, { detail: 'compact' });
        send({ ...root, code: 0, status: 200, durationMs: total });
        send({ ...client, code: 0, status: 200, durationMs: child });
        stop();
        expect(write.mock.calls[0][0].includes('Call renderer')).toBe(shown);
    },
);

it('compact prefers a qualifying nested clue to a longer sibling, but retains even tiny retries and their ancestors', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const stop = startDevTraceView('view-test', write, { detail: 'compact' });
    try {
        send({ ...root, status: 200, code: 0 });
        send({ ...client, status: 200, code: 0 });
        send({ ...server, status: 200, code: 0, durationMs: 10 });
        send({
            ...client,
            name: 'queue.wait',
            spanId: '4'.repeat(16),
            durationMs: 25,
            status: undefined,
            code: 0,
        });
        vi.advanceTimersByTime(250);
        expect(write.mock.calls[0][0]).toMatch(
            /Call renderer.*30 ms[^\n]*\n.*POST \/html-to-pdf.*10 ms/,
        );
        expect(write.mock.calls[0][0]).not.toContain('Queue wait');
        send({
            ...server,
            name: 'pdf.render',
            spanId: '5'.repeat(16),
            parentId: server.spanId,
            durationMs: 0.1,
            code: 0,
            retry: 1,
        });
    } finally {
        stop();
    }
    const block = write.mock.calls.at(-1)?.[0];
    expect(block).toContain('PATCH /invoices');
    expect(block).toContain('Call renderer');
    expect(block).toContain('→ renderer  POST /html-to-pdf');
    expect(block).toMatch(/Render PDF +retry 1/);
    expect(block).not.toContain('Queue wait');
});

it.each([
    [true, undefined, 'xterm', true],
    [false, undefined, 'xterm', false],
    [true, '', 'xterm', false],
    [true, undefined, 'dumb', false],
] as const)(
    'styles safe readable text for tty=%s NO_COLOR=%s TERM=%s',
    (tty, noColor, term, styled) => {
        vi.stubEnv('NO_COLOR', noColor);
        vi.stubEnv('TERM', term);
        const write = vi.fn();
        const stop = startDevTraceView('view-test', write, { tty });
        send({ ...root, route: '/invoices\u001b[2Jprivate' });
        send({ ...root, reason: '\nprivate' });
        send({
            ...root,
            name: 'mysql.execute',
            operation: 'select',
            collection: 'invoices\u001b[2Jprivate',
        });
        send({ ...root, status: 200, reason: 'transport', name: 'http.client.renderer' });
        stop();
        expect(write).toHaveBeenCalledTimes(1);
        const block: string = write.mock.calls[0][0];
        const plain = stripVTControlCharacters(block);
        expect(block !== plain).toBe(styled);
        expect(plain).toMatch(/Call renderer +failed {2}HTTP 200 {2}transfer after HTTP 200/);
        expect(block).not.toContain('private');
        expect(plain).not.toContain('HTTP status');
    },
);

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
});

it('uses one root-relative waterfall scale across siblings, nested services, and sub-cell spans', () => {
    vi.stubEnv('NO_COLOR', undefined);
    vi.stubEnv('TERM', 'xterm');
    const render = (tty: boolean, columns: number) => {
        const blocks: string[] = [];
        const stop = startDevTraceView('view-test', (block) => blocks.push(block), {
            tty,
            columns,
        });
        send({ ...root, startMs: 100, durationMs: 36 });
        send({ ...client, startMs: 100, durationMs: 18 });
        send({ ...server, startMs: 112, durationMs: 0.2 });
        for (const [i, startMs] of [99, 109, 120].entries())
            send({
                ...client,
                spanId: String(i + 4).repeat(16),
                startMs,
                durationMs: 10,
                name: ['mysql.acquire', 'queue.wait', 'queue.execute'][i],
            });
        stop();
        return blocks.join('');
    };
    const plain = render(false, 160);
    const styled = render(true, 160);
    expect(styled).not.toBe(plain);
    expect(stripVTControlCharacters(styled)).toBe(plain);
    const line = (label: string) => plain.split('\n').find((l) => l.includes(label))!;
    const origin = line('PATCH /invoices').indexOf('━');
    for (const [label, offset, bar] of [
        ['PATCH /invoices', 0, '━'.repeat(36)],
        ['Call renderer', 0, '━'.repeat(18)],
        ['Queue wait', 9, '━'.repeat(10)],
        ['Queue execution', 20, '━'.repeat(10)],
        ['POST /html-to-pdf', 12, '▏'],
    ] as const) {
        expect(line(label).slice(origin)).toBe(' '.repeat(offset) + bar);
        expect(line(label).length).toBeLessThanOrEqual(160);
    }
    expect(line('MySQL pool checkout')).toMatch(/10 ms +—$/);
    const narrow = render(false, 55);
    expect(narrow).not.toMatch(/Timeline|━|▏/);
    expect(narrow).toContain('0.2 ms');
});

it('quantizes adjacent fractional endpoints identically and distinguishes tiny spans from zero', () => {
    const blocks: string[] = [];
    const stop = startDevTraceView('view-test', (b) => blocks.push(b), {
        tty: false,
        columns: 160,
    });
    send({ ...root, route: undefined, startMs: 0, durationMs: 36 });
    send({ ...client, startMs: 0, durationMs: 1.6 });
    send({ ...server, startMs: 1.6, durationMs: 1.6 });
    send({ ...client, name: 'queue.wait', spanId: '4'.repeat(16), startMs: 3.2, durationMs: 0.02 });
    stop();
    const line = (label: string) => blocks[0].split('\n').find((l) => l.includes(label))!;
    const first = line('Call renderer'),
        second = line('POST /html-to-pdf');
    expect(first).toMatch(/━+$/);
    expect(second.indexOf('━')).toBe(first.length);
    expect(line('Queue wait')).toMatch(/<0\.1 ms +▏$/);
    expect(blocks[0]).toContain('PATCH (route not recorded)');
});

it('updates healthy timing highlights only when late spans change the summary', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const stop = startDevTraceView('view-test', write, { detail: 'compact' });
    try {
        send({ ...root, code: 0, status: 200 });
        send({
            ...client,
            name: 'mysql.acquire',
            spanId: '4'.repeat(16),
            durationMs: 2,
            code: 0,
            status: undefined,
        });
        vi.advanceTimersByTime(250);
        send({ ...client, code: 0, status: 200 });
        vi.advanceTimersByTime(250);
        send({
            ...client,
            name: 'queue.wait',
            spanId: '5'.repeat(16),
            durationMs: 1,
            code: 0,
            status: undefined,
        });
        vi.advanceTimersByTime(250);
    } finally {
        stop();
    }
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[0][0]).not.toContain('Call renderer');
    expect(write.mock.calls[1][0]).toMatch(/Call renderer.*30 ms/);
});

it('renders a zero-duration root without inventing elapsed time', () => {
    const write = vi.fn();
    const stop = startDevTraceView('view-test', write, { tty: false, columns: 100 });
    send({ ...root, durationMs: 0 });
    stop();
    expect(write.mock.calls[0][0]).toMatch(/0 ms +▏\n$/);
});

it('keeps concurrent traces separate, reattaches late parents, and flushes late siblings on stop', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const stop = startDevTraceView('view-test', write, { detail: 'full' });
    try {
        send(server);
        send({ ...root, traceId: 'b'.repeat(32) });
        vi.advanceTimersByTime(250);
        expect(write).toHaveBeenCalledTimes(2);
        expect(write.mock.calls[1][0]).toContain('b'.repeat(8));
        expect(write.mock.calls[0][0]).toContain('partial: parent not recorded');
        send(root);
        send(client);
        vi.advanceTimersByTime(1000);
        expect(write).toHaveBeenCalledTimes(3);
        const block = write.mock.calls[2][0];
        expect(block).toMatch(/Operation +Status \/ detail +Duration/);
        expect(block).toMatch(/└─ api {2}PATCH \/invoices +failed {2}HTTP 502 +45 ms/);
        expect(block).toMatch(/ {3}└─ Call renderer +failed {2}HTTP 502 +30 ms/);
        expect(block).toMatch(/ {6}└─ → renderer {2}POST \/html-to-pdf +failed +27 ms/);
        expect(write.mock.calls[0][0]).not.toContain('Timeline');
        expect(block).not.toContain('·');
        expect(block).not.toContain('b'.repeat(8));
        send({
            ...client,
            spanId: '4'.repeat(16),
            name: 'mysql.execute',
            operation: 'select',
            code: 0,
            status: undefined,
            startMs: 11,
        });
    } finally {
        stop();
    }
    const last = write.mock.calls[3][0];
    expect(last).toContain('   ├─ SQL SELECT');
    expect(last.indexOf('SQL SELECT')).toBeLessThan(last.indexOf('Call renderer'));
    vi.advanceTimersByTime(1000);
    expect(write).toHaveBeenCalledTimes(4);
});

it.each([false, true])(
    'flushes the first failure before eight newer successes evict it (quiet %s)',
    (quiet) => {
        vi.useFakeTimers();
        const write = vi.fn();
        const stop = startDevTraceView('view-test', write, { quiet });
        try {
            send(root);
            for (let i = 1; i <= 12; i++)
                send({ ...root, code: 0, status: 200, traceId: i.toString(16).padStart(32, '0') });
            expect(write.mock.calls[0]?.[0]).toContain('failed  HTTP 502');
            vi.advanceTimersByTime(250);
        } finally {
            stop();
        }
        expect(write).toHaveBeenCalledTimes(quiet ? 1 : 13);
        expect(write.mock.calls.flat().join('')).not.toMatch(/retention limit|partial|evicted/);
    },
);

it('does not reprint rendered summaries on turnover or shutdown', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const stop = startDevTraceView('view-test', write);
    try {
        for (let i = 1; i <= 12; i++) {
            send({ ...root, traceId: i.toString(16).padStart(32, '0') });
            vi.advanceTimersByTime(250);
        }
        expect(write).toHaveBeenCalledTimes(12);
    } finally {
        stop();
    }
    expect(write).toHaveBeenCalledTimes(12);
    expect(write.mock.calls.flat().join('')).not.toMatch(/retention limit|partial|evicted/);
});

it('opens ordinary backend sessions quietly and renders multiple traces sent over the session socket', async () => {
    const write = vi.fn();
    const session = await openDevSession(DevTarget.Backend, undefined, () => {}, undefined, write);
    try {
        expect(session.env.STAM_DEV_CAPTURE).toBe('*');
        expect(write).not.toHaveBeenCalled();
        const emitter = createDevEmitter('api', session.env);
        emitter.span(root);
        emitter.span({ ...root, traceId: 'd'.repeat(32) });
        await emitter.close();
        await expect.poll(() => write.mock.calls.length).toBe(2);
        expect(write.mock.calls[0][0]).toContain(root.traceId.slice(-8));
        expect(write.mock.calls[1][0]).toContain('d'.repeat(8));
    } finally {
        await session.close();
    }
    expect(write).toHaveBeenCalledTimes(2);
});

it.each([
    [DevTarget.Instance, 'GET /health', 'GET /health'],
    [DevTarget.Frontend, undefined, ''],
    [DevTarget.Docs, undefined, ''],
] as const)(
    'passes only the effective capture choice to %s producers',
    async (target, filter, expected) => {
        const write = vi.fn();
        const session = await openDevSession(target, filter, () => {}, undefined, write);
        try {
            expect(session.env.STAM_DEV_CAPTURE).toBe(expected);
        } finally {
            await session.close();
        }
        expect(write).not.toHaveBeenCalled();
    },
);

it('quiet reports actual omission once without showing healthy branches or guessing the lost outcome', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const stop = startDevTraceView('view-test', write, { quiet: true });
    try {
        for (let i = 1; i <= maxDevTraceSpans; i++) {
            send({ ...root, code: 0, status: 200, spanId: i.toString(16).padStart(16, '0') });
        }
        vi.advanceTimersByTime(250);
        expect(write).not.toHaveBeenCalled();
        send(root);
        vi.advanceTimersByTime(500);
    } finally {
        stop();
    }
    expect(write.mock.calls).toEqual([
        [`\n00:00:00.010Z #aaaaaaaa partial: span limit omitted additional spans\n`],
    ]);
});

it('marks only actual span loss, even when the last retained span was already displayed', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const stop = startDevTraceView('view-test', write);
    try {
        for (let i = 1; i <= maxDevTraceSpans; i++) {
            send({ ...client, spanId: i.toString(16).padStart(16, '0') });
        }
        send({ ...client, spanId: '1'.padStart(16, '0') });
        vi.advanceTimersByTime(250);
        expect(write.mock.calls[0][0]).not.toContain('span limit');
        send(root);
    } finally {
        stop();
    }
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1][0]).toContain('partial: span limit omitted additional spans');
    expect(write.mock.calls[1][0]).toContain('parent not recorded');
});

it.each(['summary', 'compact', 'full'] as const)(
    'maps the same spans to the selected trace detail %s',
    (mode) => {
        vi.useFakeTimers();
        const write = vi.fn();
        const stop = startDevTraceView('view-test', write, { detail: mode });
        const clean = { ...root, code: 0, status: 200, durationMs: 99_000 };
        try {
            send(clean);
            vi.advanceTimersByTime(250);
            send({
                ...client,
                code: 0,
                status: undefined,
                name: 'mysql.execute',
                operation: 'insert',
            });
            vi.advanceTimersByTime(250);
            const cleanBlocks = write.mock.calls.map(([block]) => block);
            if (mode !== 'full') {
                expect(cleanBlocks).toHaveLength(1);
                if (mode === 'summary') expect(cleanBlocks[0].trim().split('\n')).toHaveLength(1);
                else expect(cleanBlocks[0]).toContain('Timeline');
            } else expect(cleanBlocks.at(-1)).toContain('SQL INSERT');
            // A successful client is necessary ancestry for the failed downstream server.
            const callId = '9'.repeat(16);
            send({ ...client, spanId: callId, code: 0, status: undefined });
            send({ ...server, parentId: callId, code: 0, status: 500 });
            send({
                ...root,
                spanId: '7'.repeat(16),
                parentId: root.spanId,
                method: 'GET',
                route: '/health',
                code: 0,
                status: 404,
            });
        } finally {
            stop();
        }
        const last = write.mock.calls.at(-1)?.[0];
        expect(last).toContain('PATCH /invoices');
        if (mode !== 'summary') expect(last).toContain('Call renderer');
        expect(last).toContain('failed  HTTP 500');
        if (mode !== 'summary') expect(last).toContain('warning  HTTP 404');
        else expect(last.trim().split('\n')).toHaveLength(1);
        if (mode === 'full') expect(last).toContain('SQL INSERT');
        else expect(last).not.toContain('SQL INSERT');
    },
);
