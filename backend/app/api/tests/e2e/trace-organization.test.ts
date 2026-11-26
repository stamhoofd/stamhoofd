import { fromBinary } from '@bufbuild/protobuf';
import { ExportTraceServiceRequestSchema } from '@buf/opentelemetry_opentelemetry.bufbuild_es/opentelemetry/proto/collector/trace/v1/trace_service_pb.js';
import { attachApplication } from '@node/dev-tools/application';
import { openDevEventChannel } from '@node/dev-tools/channel';
import { subscribeDevSpans } from '@node/dev-tools/spans';
import { Router, RouterServer } from '@node/endpoints';
import { initializeTelemetry, traceEndpoint } from '@node/observability';
import { OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { Permissions, Version } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { once } from 'node:events';
import { createServer, request } from 'node:http';
import nock from 'nock';
import { GetInvoicesCountEndpoint } from '../../src/endpoints/organization/dashboard/invoices/GetInvoicesCountEndpoint.js';
import { GetOrganizationEndpoint } from '../../src/endpoints/organization/shared/auth/GetOrganizationEndpoint.js';
import { SessionService } from '../../src/services/SessionService.js';
import { testServer } from '../helpers/TestServer.js';

it('shows the matched organization route, batch stages and verified SQL owners, with a static identity for other handlers', async () => {
    const channel = await openDevEventChannel(() => {}, undefined, '*');
    for (const [key, value] of Object.entries(channel.env)) vi.stubEnv(key, value);
    vi.stubEnv('STAM_DEV_APP', 'api');
    const detach = attachApplication('api');
    const local = subscribeDevSpans(channel.env.STAM_DEV_SESSION);
    const envelopes: Buffer[] = [];
    const receiver = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
            envelopes.push(Buffer.concat(chunks));
            res.writeHead(200, { 'Content-Type': 'application/x-protobuf' }).end();
        });
    }).listen(0, '127.0.0.1');
    await once(receiver, 'listening');
    const target = receiver.address();
    if (!target || typeof target === 'string') throw Error('Expected TCP listener');
    vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', `http://127.0.0.1:${target.port}/v1/traces`);
    const runtime = initializeTelemetry('api', { ownsMetrics: false });
    const router = new Router();
    router.endpoints.push(new GetOrganizationEndpoint(), new GetInvoicesCountEndpoint());
    const app = new RouterServer(router);
    app.requestMiddlewares = testServer.requestMiddlewares;
    app.responseMiddlewares = testServer.responseMiddlewares;
    app.observeEndpoint = traceEndpoint;
    const http = createServer((req, res) => void app.requestListener(req, res)).listen(
        0,
        '127.0.0.1',
    );
    await once(http, 'listening');
    nock.enableNetConnect('127.0.0.1');
    try {
        const address = http.address();
        if (!address || typeof address === 'string') throw Error('Expected TCP listener');
        const org = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization: org,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(user);
        for (const path of ['/organization', '/invoices/count']) {
            const status = await new Promise<number | undefined>((resolve, reject) => {
                request(
                    `http://127.0.0.1:${address.port}/v${Version}${path}?canary=private`,
                    {
                        headers: {
                            host: org.getApiHost(),
                            authorization: 'Bearer ' + token.accessToken,
                        },
                    },
                    (res) => {
                        res.resume();
                        res.once('end', () => resolve(res.statusCode));
                    },
                )
                    .on('error', reject)
                    .end();
            });
            expect(status).toBe(200);
        }
        await detach();
        const [tree, count] = local.snapshot();
        expect(count.find((s) => !s.parentId)).toMatchObject({
            endpoint: 'GetInvoicesCountEndpoint',
            method: 'GET',
        });
        const root = tree.find((s) => !s.parentId)!;
        expect(root).toMatchObject({ route: '/organization', status: 200 });
        const assemble = tree.find((s) => s.name === 'organization.assemble')!;
        const auth = tree.find((s) => s.name === 'auth.authenticate')!;
        expect(auth.parentId).toBe(root.spanId);
        expect(assemble.parentId).toBe(root.spanId);
        for (const name of ['organization.period_groups', 'organization.webshop_previews'])
            expect(tree.filter((s) => s.name === name).map((s) => s.parentId)).toEqual([
                assemble.spanId,
            ]);
        expect(tree.find((s) => s.name === 'organization.resolve_scope')?.parentId).toBe(
            root.spanId,
        );
        expect(tree.find((s) => s.collections?.includes('tokens'))).toMatchObject({
            parentId: auth.spanId,
            collections: ['tokens', 'users', 'user_sessions'],
        });
        expect(JSON.stringify(local.snapshot())).not.toContain('canary');
        await runtime.shutdown();
        const exported = envelopes.flatMap((bytes) =>
            fromBinary(ExportTraceServiceRequestSchema, bytes).resourceSpans.flatMap((r) =>
                r.scopeSpans.flatMap((s) => s.spans),
            ),
        );
        const assembly = exported.find((s) => s.name === 'organization.assemble')!;
        const hex = (id: Uint8Array) => Buffer.from(id).toString('hex');
        const group = exported.filter((s) => hex(s.traceId) === hex(assembly.traceId));
        const remoteRoot = group.find((s) => !s.parentSpanId.length)!;
        expect(hex(remoteRoot.traceId)).not.toBe(root.traceId);
        expect(remoteRoot.attributes.map((a) => a.key).sort()).toEqual([
            'http.request.method',
            'http.response.status_code',
        ]);
        for (const name of [
            'auth.authenticate',
            'organization.resolve_scope',
            'organization.assemble',
            'organization.period_groups',
            'organization.webshop_previews',
        ]) {
            const stages = group.filter((s) => s.name === name);
            expect(stages).toHaveLength(1);
            expect(stages[0].kind).toBe(1);
            expect(stages[0].attributes).toEqual([]);
            expect(stages[0].parentSpanId).toEqual(
                (['organization.period_groups', 'organization.webshop_previews'].includes(name)
                    ? assembly
                    : remoteRoot
                ).spanId,
            );
        }
        for (const s of exported) {
            if (s.parentSpanId.length)
                expect(
                    exported.some(
                        (parent) =>
                            hex(parent.traceId) === hex(s.traceId) &&
                            hex(parent.spanId) === hex(s.parentSpanId),
                    ),
                ).toBe(true);
            expect(
                s.attributes.every((a) =>
                    [
                        'db.operation.name',
                        'http.request.method',
                        'http.response.status_code',
                    ].includes(a.key),
                ),
            ).toBe(true);
        }
    } finally {
        await runtime.shutdown();
        await detach();
        await channel.close();
        await new Promise<void>((r) => receiver.close(() => r()));
        await new Promise<void>((r) => http.close(() => r()));
        nock.disableNetConnect();
        vi.unstubAllEnvs();
    }
});
