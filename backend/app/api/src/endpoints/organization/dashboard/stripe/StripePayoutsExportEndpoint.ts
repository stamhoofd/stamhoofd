import type { Decoder } from '@simonbackx/simple-encoding';
import { AutoEncoder, DateDecoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Platform } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';

import { Context } from '../../../../helpers/Context.js';
import { StripePayoutReporter } from '../../../../helpers/StripePayoutReporter.js';

export class PayoutExportStatus extends AutoEncoder {
    @field({ decoder: DateDecoder })
    start: Date;

    @field({ decoder: DateDecoder })
    end: Date;

    @field({ decoder: IntegerDecoder })
    count = 0;
}

type Params = Record<string, never>;
class Body extends AutoEncoder {
    @field({ decoder: DateDecoder })
    start: Date;

    @field({ decoder: DateDecoder })
    end: Date;
}
type Query = undefined;
type ResponseBody = undefined;

/**
 * Manually build a Stripe payout report for a given period and email it (to check whether
 * everything we charged via Stripe application fees was invoiced correctly).
 */
export class StripePayoutsExportEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>;

    static queue: PayoutExportStatus[] = [];

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/stripe/payouts', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

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
                message: 'Stripe payout exports are only available for the platform membership organization',
                statusCode: 400,
            });
        }

        return { organization, user };
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization, user } = await StripePayoutsExportEndpoint.authenticate();

        if (!STAMHOOFD.STRIPE_SECRET_KEY) {
            throw new SimpleError({
                code: 'not_configured',
                message: 'Stripe is not configured',
                statusCode: 400,
            });
        }
        const secretKey = STAMHOOFD.STRIPE_SECRET_KEY;

        const start = request.body.start;
        const end = request.body.end;

        const item = PayoutExportStatus.create({
            start,
            end,
            count: 0,
        });
        StripePayoutsExportEndpoint.queue.push(item);

        // Schedule
        QueueHandler.schedule('stripe-payout-export', async () => {
            try {
                const reporter = new StripePayoutReporter({
                    secretKey,
                    sellingOrganization: organization,
                });
                let count = 0;
                reporter.callback = () => {
                    count++;
                    item.count = count;
                };

                await reporter.build(start, end);

                // Send the report to the user that requested it
                await reporter.sendEmail({
                    to: [{ email: user.email, name: user.name }],
                });
            } finally {
                // Remove from queue
                StripePayoutsExportEndpoint.queue.splice(StripePayoutsExportEndpoint.queue.indexOf(item), 1);
            }
        }).catch(console.error);

        return new Response(undefined);
    }
}
