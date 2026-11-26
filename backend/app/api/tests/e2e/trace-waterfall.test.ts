import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace';
import { fromBinary } from '@bufbuild/protobuf';
import { ExportTraceServiceRequestSchema } from '@buf/opentelemetry_opentelemetry.bufbuild_es/opentelemetry/proto/collector/trace/v1/trace_service_pb.js';
import { PatchableArray } from '@common/encoding';
import { Request, Router, RouterServer } from '@node/endpoints';
import { initializeTelemetry, traceEndpoint } from '@node/observability';
import { signInternal } from '@stamhoofd/backend-env';
import { Invoice, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { File, InvoiceStruct, Permissions, Version } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import nock from 'nock';
import { PatchInvoicesEndpoint } from '../../src/endpoints/organization/dashboard/invoices/PatchInvoicesEndpoint.js';
import { InvoicePdfService, rendererPostUrl } from '../../src/services/InvoicePdfService.js';
import { SessionService } from '../../src/services/SessionService.js';
import { testServer } from '../helpers/TestServer.js';

async function listen(server: Server) {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('Expected loopback listener');
    return `127.0.0.1:${address.port}`;
}

it('canonicalizes renderer authorities and rejects non-authorities before posting', () => {
    expect(rendererPostUrl('Renderer.Example:443', false).href).toBe(
        `https://renderer.example/v${Version}/html-to-pdf`,
    );
    for (const authority of [
        'user@renderer.example',
        'renderer.example/a',
        'renderer.example?x',
        'renderer.example#x',
        'renderer.example\\evil',
    ]) {
        expect(() => rendererPostUrl(authority, false)).toThrow();
    }
});

describe.skipIf(!process.env.STAM_BACKEND_TRACE_SMOKE)('compiled renderer integration', () => {
    it('traces concurrent numbered invoice regenerations through the real renderer HTTP handler', async () => {
        const dir = await mkdtemp(path.join(tmpdir(), 'trace-renderer-'));
        const bytes: Buffer[] = [];
        const collector = createServer((req, res) => {
            expect(req.url).toBe('/v1/traces');
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => chunks.push(chunk));
            req.on('end', () => {
                bytes.push(Buffer.concat(chunks));
                res.writeHead(200, { 'Content-Type': 'application/x-protobuf' }).end();
            });
        });
        const url = 'http://' + (await listen(collector)) + '/v1/traces';
        const child = fork(
            path.resolve(
                import.meta.dirname,
                '../../../renderer/tests/fixtures/trace-renderer.mjs',
            ),
            [],
            {
                cwd: dir,
                env: { PATH: process.env.PATH, TEST_COLLECTOR: url },
                execArgv: [],
                silent: true,
            },
        );
        const exit = once(child, 'exit');
        const apiRouter = new Router();
        apiRouter.endpoints.push(new PatchInvoicesEndpoint());
        const router = new RouterServer(apiRouter);
        router.requestMiddlewares = testServer.requestMiddlewares;
        router.responseMiddlewares = testServer.responseMiddlewares;
        router.observeEndpoint = traceEndpoint;
        const api = createServer((req, res) => {
            void router.requestListener(req, res);
        });
        let redirected = 0;
        const target = createServer((_req, res) => {
            redirected++;
            res.end();
        });
        let redirectParent: string | undefined;
        let interruptedParent: string | undefined;
        const redirect = createServer((req, res) => {
            if (redirectParent) {
                interruptedParent = req.headers.traceparent as string;
                res.writeHead(200, { 'content-length': 100 }).write('partial');
                setTimeout(() => res.destroy(), 150);
                return;
            }
            redirectParent = req.headers.traceparent as string | undefined;
            res.writeHead(307, { location: `http://${targetHost}/external` }).end();
        });
        const targetHost = await listen(target);
        const wire: { parent: string; proof: boolean }[] = [];
        const runtime = initializeTelemetry('api', {
            ownsMetrics: false,
            localProcessor: new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ url }) }),
        });
        nock.enableNetConnect('127.0.0.1');
        try {
            const [{ port }] = await Promise.race([
                once(child, 'message'),
                exit.then(() => {
                    throw Error('Renderer fixture exited before listening');
                }),
            ]);
            child.on('message', (msg: { parent: string; proof: boolean }) => wire.push(msg));
            const apiHost = await listen(api);
            const org = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization: org,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await SessionService.createSession(user);
            const invoices = await Promise.all(
                ['canary-success', 'canary-error', 'canary-unsampled', 'canary-redirect'].map(
                    async (number) => {
                        const invoice = new Invoice();
                        invoice.organizationId = org.id;
                        invoice.number = number;
                        invoice.isReceipt = true;
                        await invoice.save();
                        return invoice;
                    },
                ),
            );
            const publicParent = `00-${'f'.repeat(32)}-${'e'.repeat(16)}-01`;
            async function regenerate(invoice: Invoice) {
                const patch = new PatchableArray();
                patch.addPatch(InvoiceStruct.patch({ id: invoice.id, pdf: null }));
                const body = await Request.buildJson('PATCH', '/invoices', org.getApiHost(), patch)
                    .body;
                return new Promise<number>((resolve, reject) => {
                    const req = request(
                        `http://${apiHost}/v${Version}/invoices?private=canary-query`,
                        {
                            method: 'PATCH',
                            headers: {
                                host: org.getApiHost(),
                                'content-type': 'application/json',
                                authorization: 'Bearer ' + token.accessToken,
                                traceparent: publicParent,
                                baggage: 'user=canary-member',
                            },
                        },
                        (res) => {
                            res.resume();
                            res.on('end', () => resolve(res.statusCode!));
                        },
                    );
                    req.on('error', reject).end(body);
                });
            }
            // Use the production HTTP branch; replace only rendering inputs and external storage.
            vi.stubGlobal('STAMHOOFD', {
                ...STAMHOOFD,
                environment: 'development',
                domains: { ...STAMHOOFD.domains, rendererApi: `127.0.0.1:${port}` },
                INTERNAL_SECRET_KEY: Buffer.from('synthetic-local-only').toString('base64'),
            });
            vi.spyOn(InvoicePdfService, 'generateHtml').mockImplementation(
                async (invoice) => `<html>${invoice.number}</html>`,
            );
            vi.spyOn(InvoicePdfService, 'uploadPdf').mockResolvedValue(
                new File({
                    id: crypto.randomUUID(),
                    name: 'fixture.pdf',
                    path: 'fixture.pdf',
                    server: 'https://fixture.invalid',
                    size: 3,
                    isPrivate: false,
                    contentType: 'application/pdf',
                }),
            );

            // A valid browser PDF grant cannot authenticate its chosen trace ID.
            const form = new FormData();
            const expires = String(Date.now() + 60000);
            const grant = signInternal('html-to-pdf', 'browser', '1000', expires, 'fixture');
            for (const [key, val] of Object.entries({
                cacheId: 'browser',
                timestamp: '1000',
                expires,
                signature: grant,
            }))
                form.append(key, val);
            form.append('html', new Blob(['fixture']));
            for (const proof of [
                grant,
                signInternal('renderer-trace-v1', grant, publicParent.replace('ff', 'aa')),
            ]) {
                expect(
                    (
                        await fetch(`http://127.0.0.1:${port}/v${Version}/html-to-pdf`, {
                            method: 'POST',
                            body: form,
                            headers: { traceparent: publicParent, 'x-stam-render-trace': proof },
                        })
                    ).status,
                ).toBe(200);
            }

            const [success, failure] = await Promise.all(invoices.slice(0, 2).map(regenerate));
            expect(success).toBe(200);
            expect(failure).toBeGreaterThanOrEqual(400);
            expect(await regenerate(invoices[2])).toBe(200);
            expect(wire.slice(2).map((w) => w.proof)).toEqual([true, true, false]);
            expect(wire.at(-1)?.parent).toBe('');

            STAMHOOFD.domains.rendererApi = await listen(redirect);
            // Advance the API's monotonic sampling budget so the redirect probe carries a real signed parent.
            const monotonic = performance.now.bind(performance);
            vi.spyOn(performance, 'now').mockImplementation(() => monotonic() + 10_000);
            expect(await regenerate(invoices[3])).toBeGreaterThanOrEqual(400);
            expect(redirected).toBe(0);
            expect(redirectParent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);

            vi.spyOn(performance, 'now').mockImplementation(() => monotonic() + 20_000);
            expect(await regenerate(invoices[3])).toBeGreaterThanOrEqual(400);
            expect(interruptedParent).toBeTruthy();
            child.send('flush');
            expect((await exit)[0]).toBe(0);
            await runtime.shutdown();
            expect(Buffer.concat(bytes).toString()).not.toMatch(
                /canary|signature|SELECT .*FROM|authorization|traceparent|baggage/i,
            );
            const spans = bytes.flatMap((body) =>
                fromBinary(ExportTraceServiceRequestSchema, body).resourceSpans.flatMap((r) =>
                    r.scopeSpans.flatMap((scope) =>
                        scope.spans.map((span) => ({
                            service: r.resource?.attributes.find((a) => a.key === 'service.name')
                                ?.value?.value.value,
                            span,
                        })),
                    ),
                ),
            );
            const roots = spans.filter(({ span }) => span.parentSpanId.length === 0);
            expect(roots).toHaveLength(4);
            const hex = (id: Uint8Array) => Buffer.from(id).toString('hex');
            const traces = new Set(roots.map(({ span }) => hex(span.traceId)));
            expect(traces.size).toBe(4);
            expect(traces.has('f'.repeat(32))).toBe(false);
            expect(
                spans.every(
                    ({ span }) =>
                        traces.has(hex(span.traceId)) &&
                        !span.events.length &&
                        !span.links.length &&
                        !span.traceState,
                ),
            ).toBe(true);
            for (const { service, span: root } of roots) {
                expect(service).toBe('api');
                const group = spans.filter(({ span }) => hex(span.traceId) === hex(root.traceId));
                const clients = group.filter(({ span }) => span.name === 'http.client.renderer');
                const renders = group.filter((s) => s.service === 'renderer');
                expect(clients).toHaveLength(1);
                expect(hex(clients[0].span.parentSpanId)).toBe(hex(root.spanId));
                if (interruptedParent?.split('-')[1] === hex(root.traceId)) {
                    const transfer = clients[0].span;
                    expect(
                        transfer.attributes.find((a) => a.key === 'http.response.status_code')
                            ?.value?.value.value,
                    ).toBe(200n);
                    expect(transfer.status?.code).toBe(2);
                    expect(
                        transfer.endTimeUnixNano - transfer.startTimeUnixNano,
                    ).toBeGreaterThanOrEqual(100_000_000n);
                    expect(renders).toHaveLength(0);
                    continue;
                }
                if (redirectParent?.split('-')[1] === hex(root.traceId)) {
                    expect(renders).toHaveLength(0);
                    expect(clients[0].span.status?.code).toBe(2); // OTLP ERROR
                    continue;
                }
                expect(renders).toHaveLength(1);
                expect(renders[0].span.kind).toBe(2); // OTLP SERVER
                expect(clients[0].span.kind).toBe(3); // OTLP CLIENT
                expect(hex(renders[0].span.parentSpanId)).toBe(hex(clients[0].span.spanId));
                expect(
                    wire.some(
                        (w) =>
                            w.parent ===
                            `00-${hex(root.traceId)}-${hex(clients[0].span.spanId)}-01`,
                    ),
                ).toBe(true);
                expect(
                    group.some(
                        ({ span }) =>
                            span.name === 'mysql.execute' &&
                            hex(span.parentSpanId) === hex(root.spanId),
                    ),
                ).toBe(true);
                expect(group.every(({ span }) => !span.status?.message)).toBe(true);
                expect(renders[0].span.status?.code).toBe(root.status?.code);
            }
        } finally {
            vi.unstubAllGlobals();
            child.kill();
            await runtime.shutdown();
            vi.unstubAllEnvs();
            vi.restoreAllMocks();
            nock.disableNetConnect();
            for (const server of [api, target, redirect, collector])
                if (server.listening)
                    await new Promise<void>((resolve) => server.close(() => resolve()));
            await rm(dir, { recursive: true, force: true });
        }
    }, 30_000);
});
