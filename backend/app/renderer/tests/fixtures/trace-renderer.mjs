import { observeOtlpAttempts } from '@stamhoofd/test-utils/otlp-attempts';
import { request } from 'node:http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { BatchSpanProcessor, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import '@stamhoofd/test-utils/environment';
import { Router, RouterServer } from '@node/endpoints';
import { initializeTelemetry, traceEndpoint, traceVerifiedRender } from '@node/observability';
import { channel } from 'node:diagnostics_channel';
import { createServer } from 'node:http';
import { HtmlToPdfEndpoint } from '../../dist/endpoints/HtmlToPdfEndpoint.js';

globalThis.STAMHOOFD.CACHE_PATH = process.cwd();
globalThis.STAMHOOFD.INTERNAL_SECRET_KEY = Buffer.from('synthetic-local-only').toString('base64');
const remote = new InMemorySpanExporter();
const attempts = process.env.TEST_MODE === 'ordinary' ? observeOtlpAttempts() : undefined;
if (attempts) {
    await new Promise((resolve, reject) => request(process.env.PROBE_URL, { method: 'POST' }, (res) => {
        res.resume();
        res.on('end', resolve);
    }).on('error', reject).end());
    if (!attempts.count()) throw Error('HTTP attempt observer inactive');
}
const baseline = attempts?.count();
const runtime = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || attempts || process.env.TEST_MODE === 'upload-failure' ? initializeTelemetry('renderer') : initializeTelemetry('renderer', { localProcessor: process.env.STAM_DEV_CAPTURE ? new SimpleSpanProcessor({ exporter: remote }) : new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ url: process.env.TEST_COLLECTOR }) }) });
if (process.env.TEST_MODE === 'local') {
    for (let i = 0; i < 2; i++) {
        await traceEndpoint({}, 'GET', async () => ({ status: 200 }));
        await traceVerifiedRender(`00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`, async () => {});
    }
}
const router = new Router();
const endpoint = new HtmlToPdfEndpoint();
// Real multipart, grant verification, cache and response. No browser process or remote content.
const browser = {
    connected: true,
    newPage: async () => {
        let fail = false;
        return {
            setJavaScriptEnabled() {},
            emulateMediaType() {},
            setContent(html) {
                fail = html.includes('canary-error');
            },
            pdf() {
                if (fail) throw Error('synthetic browser failure');
                return Buffer.from('PDF');
            },
            close() {},
        };
    },
};
HtmlToPdfEndpoint.browsers = Array.from({ length: 4 }, () => ({ browser, count: 0 }));
router.endpoints.push(endpoint);
const app = new RouterServer(router);
app.observeEndpoint = traceEndpoint;
const server = createServer((req, res) => {
    process.send({ parent: req.headers.traceparent ?? '', proof: !!req.headers['x-stam-render-trace'], localParent: req.headers['x-stam-dev-render']?.split('.')[0] });
    void app.requestListener(req, res);
}).listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
process.once('message', () => server.close(async () => {
    if (!attempts && process.env.TEST_MODE !== 'upload-failure' && process.env.STAM_DEV_CAPTURE && remote.getFinishedSpans().filter(s => s.name === 'http.server.request').length !== (process.env.TEST_MODE === 'local' ? 4 : 1)) process.exitCode = 1;
    await runtime.shutdown();
    if (attempts?.count() !== baseline) process.exitCode = 1;
    attempts?.close();
    channel('stamhoofd.application.lifecycle').publish({ service: 'renderer', event: 'stopped' });
    process.disconnect();
}));
