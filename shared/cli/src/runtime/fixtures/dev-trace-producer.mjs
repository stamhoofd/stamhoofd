import { channel } from 'node:diagnostics_channel';
import { attachApplication } from '@node/dev-tools/application';
import {
    initializeTelemetry,
    traceEndpoint,
    traceQueueWait,
    traceRendererCall,
    traceStage,
    traceStatisticsCycle,
    traceVerifiedRender,
} from '@node/observability';

const service = process.argv[2];
process.env.STAM_DEV_APP = service;
const detach = attachApplication(service);
const telemetry = initializeTelemetry(service, { ownsMetrics: false });
const database = channel('stamhoofd.database.duration');
class PatchInvoicesEndpoint {}

try {
    if (service === 'api') {
        await traceEndpoint(
            {},
            'GET',
            () =>
                traceStage('auth.authenticate', async () => {
                    database.publish({
                        operation: 'select',
                        collections: ['tokens', 'users', 'user_sessions'],
                        outcome: 'success',
                        duration: 1,
                    });
                    return { status: 200 };
                }),
            undefined,
            { endpoint: 'GetInvoicesCountEndpoint' },
        );
        for (const failure of ['response', 'timeout', 'upload']) {
            await traceEndpoint(new PatchInvoicesEndpoint(), 'PATCH', async () => {
                traceQueueWait()?.(false);
                try {
                    await traceStage('queue.execute', () =>
                        traceRendererCall(async (_parent, status, localParent) => {
                            if (failure === 'timeout')
                                throw new DOMException('private detail', 'AbortError');
                            if (localParent) console.log(localParent);
                            if (failure === 'upload') {
                                status(200);
                                return;
                            }
                            status(500);
                            throw new Error('private body');
                        }),
                    );
                    await traceStage('invoice.upload', () =>
                        traceStage('storage.put', async () => {
                            throw Object.assign(new Error('private credentials'), {
                                $metadata: { httpStatusCode: 503, attempts: 4 },
                            });
                        }),
                    );
                } catch {
                    return { status: 500 };
                }
                return { status: 200 };
            });
        }
    } else if (service === 'renderer') {
        await traceVerifiedRender(
            undefined,
            () => traceStage('pdf.render', async () => null, { retry: 2 }),
            process.argv[3],
        );
        await traceVerifiedRender(
            undefined,
            () => traceStage('pdf.render', async () => new Uint8Array(1), { retry: 0 }),
            process.argv[4],
        );
    } else {
        for (const outcome of ['error', 'success']) {
            await traceStatisticsCycle(() =>
                traceStage('statistics.incremental', async () => {
                    database.publish({ operation: 'acquire', outcome, duration: 2 });
                    if (outcome === 'success')
                        database.publish({
                            operation: 'select',
                            collection: 'invoices',
                            outcome,
                            duration: 4,
                        });
                    else throw new Error('private credentials');
                }),
            ).catch(() => {});
        }
    }
} finally {
    await detach();
    await telemetry.shutdown();
}
