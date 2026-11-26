import { observeOtlpAttempts } from '@stamhoofd/test-utils/otlp-attempts';
import { openDevEventChannel } from '@node/dev-tools/channel';
import { attachApplication } from '@node/dev-tools/application';
import { subscribeDevSpans } from '@node/dev-tools/spans';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import {
    BatchSpanProcessor,
    InMemorySpanExporter,
    SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace';
import { fromBinary } from '@bufbuild/protobuf';
import { ExportTraceServiceRequestSchema } from '@buf/opentelemetry_opentelemetry.bufbuild_es/opentelemetry/proto/collector/trace/v1/trace_service_pb.js';
import { PatchableArray } from '@common/encoding';
import { Request, Router, RouterServer } from '@node/endpoints';
import { initializeTelemetry, traceEndpoint } from '@node/observability';
import { signInternal } from '@stamhoofd/backend-env';
import { Image, Invoice, OrganizationFactory, UserFactory } from '@stamhoofd/models';
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
import { InvoicePdfService } from '../../src/services/InvoicePdfService.js';
import { SessionService } from '../../src/services/SessionService.js';
import { testServer } from '../helpers/TestServer.js';

async function listen(server: Server) {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('Expected loopback listener');
    return `127.0.0.1:${address.port}`;
}

export async function runWaterfall(
    mode: 'production' | 'local' | 'both' | 'ordinary' | 'unpinned' | 'upload-failure',
) {
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
    const attempts = mode === 'ordinary' ? observeOtlpAttempts() : undefined;
    if (attempts) {
        // Exercise both HTTP stacks before startup; the observer must see real sends.
        nock.enableNetConnect('127.0.0.1');
        await fetch(url, { method: 'POST' });
        const before = attempts.count();
        expect(before).toBeGreaterThan(0);
        await new Promise<void>((resolve, reject) =>
            request(url, { method: 'POST' }, (res) => {
                res.resume();
                res.on('end', resolve);
            })
                .on('error', reject)
                .end(),
        );
        expect(attempts.count()).toBeGreaterThan(before);
    }
    const baseline = attempts?.count();
    const capture =
        mode !== 'production'
            ? await openDevEventChannel(
                  () => {},
                  undefined,
                  mode === 'ordinary' ? '*' : 'PATCH /invoices',
              )
            : undefined;
    const subscriber = capture && subscribeDevSpans(capture.env.STAM_DEV_SESSION);
    if (capture) {
        for (const [key, value] of Object.entries(capture.env)) vi.stubEnv(key, value);
        vi.stubEnv('STAM_DEV_APP', 'api');
    }
    const detach = capture && attachApplication('api');
    const child = fork(
        path.resolve(import.meta.dirname, '../../../renderer/tests/fixtures/trace-renderer.mjs'),
        [],
        {
            cwd: dir,
            env: {
                PATH: process.env.PATH,
                ...(capture
                    ? { ...capture.env, STAM_DEV_APP: 'renderer', TEST_MODE: mode, PROBE_URL: url }
                    : { TEST_COLLECTOR: url }),
            },
            execArgv: capture
                ? ['--import', import.meta.resolve('@node/dev-tools/application')]
                : [],
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
    let probe: 'timeout' | 'http_status' | undefined;
    const causes = new Map<string, string>();
    const redirect = createServer((req, res) => {
        if (probe) {
            causes.set(String(req.headers.traceparent).split('-')[1], probe);
            if (probe === 'timeout') setTimeout(() => res.end(), 500);
            else res.writeHead(500).end();
            return;
        }
        if (redirectParent) {
            interruptedParent = req.headers.traceparent as string;
            res.writeHead(200, { 'content-length': 100 }).write('partial');
            setTimeout(() => res.destroy(), 150);
            return;
        }
        redirectParent = req.headers.traceparent as string | undefined;
        res.writeHead(307, { location: `http://${targetHost}/external` }).end();
    });
    let proxied = 0;
    const proxyHeaders: (string | string[] | undefined)[] = [];
    const proxy = createServer((req, res) => {
        proxyHeaders.push(req.headers['x-stam-dev-render']);
        proxied++;
        res.writeHead(400).end();
    });
    const targetHost = await listen(target);
    const wire: { parent: string; proof: boolean; localParent?: string }[] = [];
    const remote = new InMemorySpanExporter();
    const runtime =
        mode === 'ordinary' || mode === 'upload-failure'
            ? initializeTelemetry('api')
            : initializeTelemetry('api', {
                  ownsMetrics: false,
                  localProcessor: capture
                      ? new SimpleSpanProcessor({ exporter: remote })
                      : new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ url }) }),
              });
    nock.enableNetConnect('127.0.0.1');
    try {
        const [{ port }] = await Promise.race([
            once(child, 'message'),
            exit.then(() => {
                throw Error('Renderer fixture exited before listening');
            }),
        ]);
        child.on('message', (msg: { parent: string; proof: boolean; localParent?: string }) =>
            wire.push(msg),
        );
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
        async function regenerate(invoice: Invoice | Invoice[]) {
            const patch = new PatchableArray();
            for (const item of Array.isArray(invoice) ? invoice : [invoice])
                patch.addPatch(InvoiceStruct.patch({ id: item.id, pdf: null }));
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
        const put = vi.spyOn(Image.getS3Client(), 'send').mockResolvedValue(undefined);
        vi.spyOn(File.prototype, 'sign').mockResolvedValue(true);

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

        if (capture && subscriber) {
            for (const proof of [
                '',
                grant,
                signInternal('dev-render-trace-v1', 'wrong-session', grant, publicParent),
                signInternal(
                    'dev-render-trace-v1',
                    capture.env.STAM_DEV_SESSION,
                    'wrong-grant',
                    publicParent,
                ),
            ]) {
                expect(
                    (
                        await fetch(`http://127.0.0.1:${port}/v${Version}/html-to-pdf`, {
                            method: 'POST',
                            body: form,
                            headers: { 'x-stam-dev-render': `${publicParent}.${proof}` },
                        })
                    ).status,
                ).toBe(200);
            }
            wire.length = 0;
            // The ordinary authority is a separate local listener. Only the selected request bypasses it.
            STAMHOOFD.domains.rendererApi = await listen(proxy);
            if (mode === 'unpinned') {
                vi.stubEnv('STAM_DEV_RENDERER_AUTHORITY', 'different.invalid');
                expect(await regenerate(invoices[0])).toBe(400);
                expect(proxyHeaders).toEqual([undefined]);
                await detach?.();
                await expect
                    .poll(() =>
                        subscriber
                            .snapshot()
                            .flat()
                            .some(
                                (s) =>
                                    s.name === 'http.client.renderer' &&
                                    s.reason === 'http_status' &&
                                    s.status === 400,
                            ),
                    )
                    .toBe(true);
                return;
            }
            vi.stubEnv('STAM_DEV_RENDERER_AUTHORITY', STAMHOOFD.domains.rendererApi);
            vi.stubEnv('STAM_DEV_RENDERER_PORT', String(port));
            if (mode === 'upload-failure') {
                put.mockRejectedValueOnce(
                    Object.assign(Error('canary-private-provider'), {
                        $metadata: {
                            httpStatusCode: 503,
                            attempts: 4,
                            requestId: 'canary-private',
                        },
                    }),
                );
                expect(await regenerate(invoices[0])).toBe(400);
                child.send('flush');
                expect((await exit)[0]).toBe(0);
                await detach?.();
                const [tree] = subscriber.snapshot();
                const root = tree.find((s) => !s.parentId)!;
                expect(root.code).toBe(2);
                const client = tree.filter((s) => s.name === 'http.client.renderer');
                expect(client).toHaveLength(1);
                expect(client[0]).toMatchObject({ code: 0, status: 200, parentId: root.spanId });
                expect(tree.some((s) => s.name === 'pdf.render' && s.code === 0)).toBe(true);
                const upload = tree.find((s) => s.name === 'invoice.upload')!;
                expect(upload).toMatchObject({ reason: 'upload', parentId: root.spanId });
                expect(tree.filter((s) => s.name === 'storage.put')).toEqual([
                    expect.objectContaining({
                        reason: 'http_status',
                        retry: 3,
                        status: 503,
                        parentId: upload.spanId,
                    }),
                ]);
                expect(
                    tree.every((s) => s.traceId === root.traceId && s.name !== 'invoice.persist'),
                ).toBe(true);
                expect(JSON.stringify(tree)).not.toContain('canary');
                expect(bytes).toHaveLength(0);
                return;
            }
            if (mode === 'local')
                for (let i = 0; i < 2; i++)
                    await traceEndpoint({}, 'GET', async () => ({ status: 200 }));
            const before = remote.getFinishedSpans().length;
            expect(before).toBe(mode === 'local' ? 2 : 0);
            const first = await regenerate(
                mode === 'ordinary' ? [invoices[0], invoices[2], invoices[3]] : invoices[0],
            );
            if (mode !== 'ordinary') await traceEndpoint({}, 'GET', async () => ({ status: 200 }));
            expect([first, await regenerate(invoices[1])]).toEqual([200, 400]);
            expect(proxied).toBe(0);
            child.send('flush');
            expect((await exit)[0]).toBe(0);
            await detach?.();
            if (mode === 'local') {
                expect(remote.getFinishedSpans()).toHaveLength(before);
                expect(wire.every((w) => !w.proof)).toBe(true);
            }
            const parents = wire.flatMap((w) =>
                w.localParent && w.localParent !== publicParent ? [w.localParent] : [],
            );
            expect(parents).toHaveLength(mode === 'ordinary' ? 4 : 2);
            await expect
                .poll(
                    () =>
                        subscriber
                            .snapshot()
                            .flat()
                            .filter((s) => !s.parentId).length,
                )
                .toBe(2);
            const [tree, second] = subscriber.snapshot();
            {
                const root = second.find((s) => !s.parentId)!;
                expect(root).toMatchObject({ method: 'PATCH', route: '/invoices', code: 2 });
                expect(root.traceId).not.toBe(tree[0].traceId);
                const client = second.find((s) => s.name === 'http.client.renderer')!;
                expect(client.parentId).toBe(root.spanId);
                expect(
                    second.some((s) => s.service === 'renderer' && s.parentId === client.spanId),
                ).toBe(true);
                expect(parents.at(-1)).toBe(`00-${root.traceId}-${client.spanId}-01`);
            }
            const root = tree.find((s) => !s.parentId)!;
            const client = tree.find((s) => s.name === 'http.client.renderer')!;
            const render = tree.find(
                (s) => s.service === 'renderer' && s.name === 'http.server.request',
            )!;
            expect([root.service, root.method, root.route]).toEqual(['api', 'PATCH', '/invoices']);
            if (mode === 'both') {
                expect(
                    remote
                        .getFinishedSpans()
                        .filter((s) => !s.parentSpanContext)
                        .map((s) => s.attributes['http.request.method']),
                ).toEqual(['PATCH', 'GET']);
                const production = wire.find((w) => w.proof && w.localParent === parents[0]);
                expect(production?.parent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
                expect(production?.parent.split('-')[1]).not.toBe(root.traceId);
                expect(
                    remote
                        .getFinishedSpans()
                        .some((s) => s.spanContext().traceId === production?.parent.split('-')[1]),
                ).toBe(true);
            }
            expect(tree.some((s) => s.name === 'mysql.acquire' && s.operation === 'acquire')).toBe(
                true,
            );
            expect(tree.some((s) => s.name === 'pdf.render' && s.retry === 0 && s.kind === 0)).toBe(
                true,
            );
            expect(tree.some((s) => s.name === 'queue.wait')).toBe(true);
            expect(tree.some((s) => s.name === 'queue.execute')).toBe(true);
            const upload = tree.find((s) => s.name === 'invoice.upload')!;
            expect(tree.some((s) => s.name === 'storage.put' && s.parentId === upload.spanId)).toBe(
                true,
            );
            expect(tree.some((s) => s.name === 'invoice.persist')).toBe(true);
            expect(client.parentId).toBe(root.spanId);
            for (const parent of parents.filter((p) => p.split('-')[1] === root.traceId)) {
                const id = parent.split('-')[2];
                expect(tree.some((s) => s.spanId === id && s.name === 'http.client.renderer')).toBe(
                    true,
                );
                expect(tree.some((s) => s.parentId === id && s.service === 'renderer')).toBe(true);
            }
            expect(render.parentId).toBe(client.spanId);
            expect(render.route).toBe('/html-to-pdf');
            expect(parents[0]).toBe(`00-${root.traceId}-${client.spanId}-01`);
            expect(tree.every((s) => s.traceId === root.traceId)).toBe(true);
            expect(tree.some((s) => s.operation === 'select' && s.parentId === root.spanId)).toBe(
                true,
            );
            expect(JSON.stringify(tree)).not.toMatch(
                /canary|signature|baggage|authorization|fixture/i,
            );
            await runtime.shutdown();
            if (attempts) expect(attempts.count()).toBe(baseline);
            expect(bytes).toHaveLength(attempts ? 3 : 0);
            return;
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
        const advance = (step: number) =>
            vi.spyOn(performance, 'now').mockImplementation(() => monotonic() + step * 10_000);
        advance(3);
        probe = 'http_status';
        expect(await regenerate(invoices[3])).toBeGreaterThanOrEqual(400);
        advance(4);
        probe = 'timeout';
        const timer = globalThis.setTimeout;
        vi.stubGlobal(
            'setTimeout',
            new Proxy(timer, {
                apply(target, receiver, args) {
                    if (args[1] === 30_000) args[1] = 100;
                    return Reflect.apply(target, receiver, args);
                },
            }),
        );
        expect(await regenerate(invoices[3])).toBeGreaterThanOrEqual(400);
        vi.stubGlobal('setTimeout', timer);
        STAMHOOFD.domains.rendererApi = `127.0.0.1:${port}`;
        advance(5);
        put.mockRejectedValueOnce(Error('canary-provider'));
        expect(await regenerate(invoices[3])).toBeGreaterThanOrEqual(400);
        causes.set(wire.at(-1)!.parent.split('-')[1], 'upload');
        advance(6);
        const save = Invoice.prototype.save;
        vi.spyOn(Invoice.prototype, 'save').mockImplementation(function (this: Invoice, ...args) {
            if (this.pdf) throw Error('canary-persistence');
            return save.apply(this, args);
        });
        expect(await regenerate(invoices[3])).toBeGreaterThanOrEqual(400);
        causes.set(wire.at(-1)!.parent.split('-')[1], 'persistence');
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
                        service: r.resource?.attributes.find((a) => a.key === 'service.name')?.value
                            ?.value.value,
                        span,
                    })),
                ),
            ),
        );
        const roots = spans.filter(({ span }) => span.parentSpanId.length === 0);
        expect(roots).toHaveLength(8);
        const hex = (id: Uint8Array) => Buffer.from(id).toString('hex');
        const traces = new Set(roots.map(({ span }) => hex(span.traceId)));
        expect(traces.size).toBe(8);
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
            const renders = group.filter(
                (s) => s.service === 'renderer' && s.span.name === 'http.server.request',
            );
            expect(clients).toHaveLength(1);
            expect(hex(clients[0].span.parentSpanId)).toBe(hex(root.spanId));
            const cause = causes.get(hex(root.traceId));
            const errorType = (name: string) =>
                group
                    .find((s) => s.span.name === name)
                    ?.span.attributes.find((a) => a.key === 'error.type')?.value?.value.value;
            if (cause === 'timeout' || cause === 'http_status') {
                expect(errorType('http.client.renderer')).toBe(cause);
                expect(
                    clients[0].span.attributes.find((a) => a.key === 'http.response.status_code')
                        ?.value?.value.value,
                ).toBe(cause === 'timeout' ? undefined : 500n);
                continue;
            }
            if (cause === 'upload' || cause === 'persistence') {
                expect(clients[0].span.status?.code).toBe(0);
                expect(errorType('http.client.renderer')).toBeUndefined();
                expect(errorType(cause === 'upload' ? 'invoice.upload' : 'invoice.persist')).toBe(
                    cause,
                );
                expect(errorType('storage.put')).toBe(cause === 'upload' ? 'provider' : undefined);
                const upload = group.find((s) => s.span.name === 'invoice.upload')!.span;
                const storage = group.find((s) => s.span.name === 'storage.put')!.span;
                expect(hex(upload.parentSpanId)).toBe(hex(root.spanId));
                expect(hex(storage.parentSpanId)).toBe(hex(upload.spanId));
                expect(group.some((s) => s.span.name === 'invoice.persist')).toBe(
                    cause === 'persistence',
                );
                continue;
            }
            if (interruptedParent?.split('-')[1] === hex(root.traceId)) {
                expect(errorType('http.client.renderer')).toBe('transport');
                const transfer = clients[0].span;
                expect(
                    transfer.attributes.find((a) => a.key === 'http.response.status_code')?.value
                        ?.value.value,
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
            const attempts = group.filter((s) => s.span.name === 'pdf.render');
            expect(
                attempts.map(
                    (s) =>
                        s.span.attributes.find((a) => a.key === 'retry.count')?.value?.value.value,
                ),
            ).toEqual(root.status?.code ? [0n, 1n, 2n] : [0n]);
            expect(errorType('pdf.render')).toBe(root.status?.code ? 'render' : undefined);
            expect(renders).toHaveLength(1);
            expect(renders[0].span.kind).toBe(2); // OTLP SERVER
            expect(clients[0].span.kind).toBe(3); // OTLP CLIENT
            expect(hex(renders[0].span.parentSpanId)).toBe(hex(clients[0].span.spanId));
            expect(
                wire.some(
                    (w) => w.parent === `00-${hex(root.traceId)}-${hex(clients[0].span.spanId)}-01`,
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
        attempts?.close();
        await detach?.();
        await capture?.close();
        subscriber?.close();
        vi.unstubAllGlobals();
        child.kill();
        await runtime.shutdown();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
        nock.disableNetConnect();
        for (const server of [api, target, redirect, collector, proxy])
            if (server.listening)
                await new Promise<void>((resolve) => server.close(() => resolve()));
        await rm(dir, { recursive: true, force: true });
    }
}
