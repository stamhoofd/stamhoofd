import '@stamhoofd/test-utils/environment';
import { observeOtlpAttempts } from '@stamhoofd/test-utils/otlp-attempts';
import { context, ROOT_CONTEXT, trace } from '@opentelemetry/api';
import { fromBinary } from '@bufbuild/protobuf';
import { ExportTraceServiceRequestSchema } from '@buf/opentelemetry_opentelemetry.bufbuild_es/opentelemetry/proto/collector/trace/v1/trace_service_pb.js';
import { DecodedRequest, Router, RouterServer } from '@node/endpoints';
import { initializeBackendRecords } from '@node/logging';
import { initializeTelemetry, traceEndpoint } from '@node/observability';
import { subscribeDevSpans } from '@node/dev-tools/spans';
import { openDevEventChannel } from '@node/dev-tools/channel';
import { attachApplication } from '@node/dev-tools/application';
import { LogMiddleware } from '@stamhoofd/backend-middleware';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const mode = process.argv[2];
const spans = [];
const receiver = createServer(async (req, res) => {
    const bytes = [];
    for await (const chunk of req) bytes.push(chunk);
    if (req.method === 'POST') {
        assert.equal(req.url, '/v1/traces');
        const envelope = fromBinary(ExportTraceServiceRequestSchema, Buffer.concat(bytes));
        spans.push(...envelope.resourceSpans.flatMap((r) => r.scopeSpans.flatMap((s) => s.spans)));
    }
    res.writeHead(200, { 'Content-Type': 'application/x-protobuf' }).end();
}).listen(0, '127.0.0.1');
await once(receiver, 'listening');
const url = `http://127.0.0.1:${receiver.address().port}/v1/traces`;
const attempts = observeOtlpAttempts();
await (await fetch(url)).arrayBuffer();
const baseline = attempts.count();
assert.ok(baseline > 0);
if (mode === 'both') process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = url;
const session = mode !== 'off' && (await openDevEventChannel(() => {}, undefined, '*'));
if (session) Object.assign(process.env, session.env, { STAM_DEV_APP: 'api' });
const local = session && subscribeDevSpans(session.env.STAM_DEV_SESSION);
const detach = session && attachApplication('api');
initializeBackendRecords('api');
const runtime = initializeTelemetry('api', { ownsMetrics: false });
const router = new Router();
const server = new RouterServer(router);
server.observeEndpoint = traceEndpoint;
server.addRequestMiddleware(LogMiddleware);
const foreign = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceFlags: 1, isRemote: true };
const ambient = trace.setSpanContext(ROOT_CONTEXT, foreign);
// Cover the error unwind itself, outside the handler's context.
server.addResponseMiddleware({
    handleResponse: (req, res) =>
        context.with(ambient, () => {
            assert.equal(trace.getSpanContext(context.active())?.traceId, foreign.traceId);
            LogMiddleware.handleResponse(req, res);
        }),
});
const started = Promise.withResolvers();
const release = Promise.withResolvers();
router.endpoints.push({
    decode(req) {
        if (req.method === 'DELETE') throw Error('private-decode');
        return DecodedRequest.fromRequest(req, {}, undefined, undefined);
    },
    async handle(req) {
        if (req.method === 'GET') {
            started.resolve();
            await release.promise;
        }
        throw Error('private-handler');
    },
});
server.listen(0);
await once(server.server, 'listening');
async function fail(method) {
    const response = await fetch(`http://127.0.0.1:${server.server.address().port}/v1/private`, {
        method,
        headers: {
            traceparent: `00-${foreign.traceId}-${foreign.spanId}-01`,
            trace_id: foreign.traceId,
            span_id: foreign.spanId,
        },
    });
    assert.equal(response.status, 500);
    await response.arrayBuffer();
}
try {
    const first = fail('GET');
    await started.promise;
    await fail('POST');
    release.resolve();
    await first;
    await fail('PATCH'); // third matched request is outside the production burst
    await fail('DELETE'); // no matched endpoint; ambient context still present at the writer
    if (detach) await detach();
    await runtime.shutdown();
    const records = (await readFile('dedicated.jsonl', 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(
        records.map((r) => r.method),
        ['POST', 'GET', 'PATCH', 'DELETE'],
    );
    assert.equal(spans.length, mode === 'both' ? 2 : 0);
    if (local) assert.equal(local.snapshot().length, 3);
    if (mode !== 'both') assert.equal(attempts.count(), baseline);
    for (const record of records) {
        const span = spans.find((s) =>
            s.attributes.some(
                (a) => a.key === 'http.request.method' && a.value.value.value === record.method,
            ),
        );
        if (span) {
            assert.equal(span.name, 'http.server.request');
            assert.equal(span.status.code, 2);
            assert.equal(record.trace_id, Buffer.from(span.traceId).toString('hex'));
            assert.equal(record.span_id, Buffer.from(span.spanId).toString('hex'));
            assert.notEqual(record.trace_id, foreign.traceId);
            assert.notEqual(record.span_id, foreign.spanId);
            assert.ok(
                !local
                    .snapshot()
                    .flat()
                    .some((s) => s.traceId === record.trace_id || s.spanId === record.span_id),
            );
        } else {
            assert.ok(!('trace_id' in record) && !('span_id' in record));
        }
    }
} finally {
    release.resolve();
    await runtime.shutdown();
    if (session) await session.close();
    attempts.close();
    await server.close();
    await new Promise((resolve) => receiver.close(resolve));
}
