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
    } finally {
        await runtime.shutdown();
        await detach();
        await channel.close();
        await new Promise<void>((r) => http.close(() => r()));
        nock.disableNetConnect();
        vi.unstubAllEnvs();
    }
});
