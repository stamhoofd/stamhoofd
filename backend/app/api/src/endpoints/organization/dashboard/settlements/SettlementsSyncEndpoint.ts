import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { QueueHandler } from '@stamhoofd/queues';
import { PaymentProvider } from '@stamhoofd/structures';
import { SettlementsSyncStatus } from '@stamhoofd/structures/settlements/SettlementsSyncStatus.js';

import { SettlementSyncRunner } from '../../../../helpers/SettlementSyncRunner.js';
import { StripeFeeInvoiceBackfill } from '../../../../helpers/StripeFeeInvoiceBackfill.js';
import { StripePayoutsExportEndpoint } from '../stripe/StripePayoutsExportEndpoint.js';

type Params = Record<string, never>;
class Body extends AutoEncoder {
    @field({ decoder: DateDecoder, optional: true })
    start: Date = new Date(2025, 0, 1);

    @field({ decoder: DateDecoder, nullable: true, optional: true })
    end: Date | null = null;

    @field({ decoder: new ArrayDecoder(new EnumDecoder(PaymentProvider)), nullable: true, optional: true })
    providers: PaymentProvider[] | null = null;

    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true, optional: true })
    accountIds: string[] | null = null;

    @field({ decoder: BooleanDecoder, optional: true })
    force = false;

    /**
     * Afterwards, mark the Received fee rows of months the old invoicer already billed as
     * invoiced (see StripeFeeInvoiceBackfill).
     */
    @field({ decoder: BooleanDecoder, optional: true })
    backfillInvoiced = true;
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

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization } = await StripePayoutsExportEndpoint.authenticate();

        const { start, end, providers, accountIds, force, backfillInvoiced } = request.body;

        const item = SettlementsSyncStatus.create({
            start,
            end,
            force,
        });
        SettlementsSyncEndpoint.queue.push(item);

        QueueHandler.schedule('settlement-sync', async () => {
            try {
                const runner = new SettlementSyncRunner();
                runner.callback = (summary) => {
                    item.count = summary.synced + summary.skipped + summary.failed;
                    item.failed = summary.failed + summary.failedFeeMonths;
                };
                await runner.run({ start, end, providers, accountIds, force });

                if (backfillInvoiced) {
                    await StripeFeeInvoiceBackfill.backfillAll(organization, { start });
                }
            } finally {
                SettlementsSyncEndpoint.queue.splice(SettlementsSyncEndpoint.queue.indexOf(item), 1);
            }
        }).catch(console.error);

        return new Response(undefined);
    }
}
