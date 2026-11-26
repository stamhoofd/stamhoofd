import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace';
import '@stamhoofd/test-utils/environment';
import { Router, RouterServer } from '@node/endpoints';
import { initializeTelemetry, traceEndpoint } from '@node/observability';
import { createServer } from 'node:http';
import { HtmlToPdfEndpoint } from '../../dist/endpoints/HtmlToPdfEndpoint.js';

globalThis.STAMHOOFD.CACHE_PATH = process.cwd();
globalThis.STAMHOOFD.INTERNAL_SECRET_KEY = Buffer.from('synthetic-local-only').toString('base64');
const runtime = initializeTelemetry('renderer', { localProcessor: new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ url: process.env.TEST_COLLECTOR }) }) });
const router = new Router();
const endpoint = new HtmlToPdfEndpoint();
// Real multipart, grant verification, cache and response. No browser process or remote content.
endpoint.htmlToPdf = async html => html.includes('canary-error') ? null : Buffer.from('PDF');
router.endpoints.push(endpoint);
const app = new RouterServer(router);
app.observeEndpoint = traceEndpoint;
const server = createServer((req, res) => {
    process.send({ parent: req.headers.traceparent ?? '', proof: !!req.headers['x-stam-render-trace'] });
    void app.requestListener(req, res);
}).listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
process.once('message', () => server.close(async () => {
    await runtime.shutdown();
    process.exit(0);
}));
