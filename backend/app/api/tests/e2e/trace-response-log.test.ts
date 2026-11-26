import { attachApplication } from '@node/dev-tools/application';
import { openDevEventChannel } from '@node/dev-tools/channel';
import { subscribeDevSpans } from '@node/dev-tools/spans';
import { Request, Response } from '@node/endpoints';
import { initializeTelemetry, traceEndpoint } from '@node/observability';
import { LogMiddleware } from '@stamhoofd/backend-middleware';

it('replaces only the successful response of the matched local request', async () => {
    const channel = await openDevEventChannel(() => {}, undefined, 'GET /invoices');
    for (const [k, v] of Object.entries(channel.env)) vi.stubEnv(k, v);
    vi.stubEnv('STAM_DEV_APP', 'api');
    const subscriber = subscribeDevSpans(channel.env.STAM_DEV_SESSION);
    const detach = attachApplication('api');
    const runtime = initializeTelemetry('api', { ownsMetrics: false });
    class GetInvoicesEndpoint {}
    const output = vi.spyOn(process.stdout, 'write');
    const errors = vi.spyOn(process.stderr, 'write');
    const req = () => Request.get({ path: '/private' });
    const first = req(),
        second = req();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    try {
        const pending = traceEndpoint(
            new GetInvoicesEndpoint(),
            'GET',
            async () => {
                await gate;
                return { status: 200 };
            },
            first,
        );
        await traceEndpoint({}, 'GET', async () => ({ status: 200 }), second);
        release();
        await pending;
        for (const r of [second, first])
            await LogMiddleware.handleResponse!(r, new Response(undefined, 200));
        await LogMiddleware.handleResponse!(first, new Response(undefined, 500));
        const lines = (calls: unknown[][]) =>
            calls.filter(
                ([line]) => typeof line === 'string' && line.includes('"event":"http.response"'),
            );
        expect(lines(output.mock.calls)).toHaveLength(1);
        expect(lines(errors.mock.calls)).toHaveLength(1);
        expect([first.localTraceQueued, second.localTraceQueued]).toEqual([true, false]);
        await detach();
        expect(subscriber.snapshot()).toHaveLength(1);
    } finally {
        release();
        output.mockRestore();
        errors.mockRestore();
        await runtime.shutdown();
        await detach();
        await channel.close();
        vi.unstubAllEnvs();
    }
});
