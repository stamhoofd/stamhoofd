import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Platform } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PaymentProvider } from '@stamhoofd/structures';
import { SettlementsSyncStatus } from '@stamhoofd/structures/settlements/SettlementsSyncStatus.js';

import { Context } from '../../../../helpers/Context.js';
import { SettlementSyncRunner } from '../../../../helpers/SettlementSyncRunner.js';

type Params = Record<string, never>;
class Body extends AutoEncoder {
    @field({ decoder: DateDecoder, optional: true })
    start: Date = new Date(2025, 0, 1);

    @field({ decoder: DateDecoder, nullable: true, optional: true })
    end: Date | null = null;

    @field({ decoder: new ArrayDecoder(new EnumDecoder(PaymentProvider)), nullable: true, optional: true })
    providers: PaymentProvider[] | null = null;

    @field({ decoder: BooleanDecoder, optional: true })
    force = false;
}
type Query = undefined;
type ResponseBody = undefined;

/**
 * Manually run the settlement sync (backfill) over a period. Everything is an upsert and
 * already-synced settlements are skipped unless force, so re-running is cheap.
 */
export class SettlementsSyncEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>;

    static queue: SettlementsSyncStatus[] = [];

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/settlements/sync', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    /**
     * A sync covers the provider accounts of the whole platform: only platform admins, and only
     * scoped to the platform membership organization (the owner of the platform's own payouts).
     */
    static async authenticate() {
        const organization = await Context.setOrganizationScope();
        const { user } = await Context.authenticate();

        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error();
        }

        const platform = await Platform.getShared();
        if (!platform.membershipOrganizationId || platform.membershipOrganizationId !== organization.id) {
            throw new SimpleError({
                code: 'not_available',
                message: 'Settlement syncs are only available for the platform membership organization',
                statusCode: 400,
            });
        }

        return { organization, user };
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await SettlementsSyncEndpoint.authenticate();

        const { start, end, providers, force } = request.body;

        const item = SettlementsSyncStatus.create({
            start,
            end,
            force,
        });
        SettlementsSyncEndpoint.queue.push(item);

        // A shutdown aborts the queue: the run stops at its next safe point instead of holding up
        // the restart, and the status list is cleaned up whether the run finished, was aborted, or
        // was canceled before it started
        QueueHandler.schedule('settlement-sync', async ({ abort }) => {
            const runner = new SettlementSyncRunner();
            runner.callback = (summary) => {
                item.count = summary.synced + summary.skipped + summary.failed;
                item.failed = summary.failed + summary.failedFeeMonths;
            };
            await runner.run({ start, end, providers, stripe: { force }, abort });
        }).finally(() => {
            SettlementsSyncEndpoint.queue = SettlementsSyncEndpoint.queue.filter(queued => queued !== item);
        }).catch(console.error);

        return new Response(undefined);
    }
}
