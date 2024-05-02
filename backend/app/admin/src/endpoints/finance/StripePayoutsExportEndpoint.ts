import { AutoEncoder, DateDecoder, Decoder, field } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { QueueHandler } from '@stamhoofd/queues';
import { sleep } from '@stamhoofd/utility';

import { StripePayoutReporter } from '../../helpers/StripePayoutReporter';
import { AdminToken } from '../../models/AdminToken';
import { PayoutExportStatus } from './GetStripePayoutsExportStatusEndpoint';

type Params = Record<string, never>;
class Body extends AutoEncoder {
    @field({ decoder: DateDecoder })
    start: Date

    @field({ decoder: DateDecoder })
    end: Date
}

type Query = undefined;
type ResponseBody = undefined

export class StripePayoutExportEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>;

    static queue: PayoutExportStatus[] = []

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/stripe/payouts", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await AdminToken.authenticate(request);
        
        const start = request.body.start
        const end = request.body.end

        const item = PayoutExportStatus.create({
            ...request.body,
            count: 0
        })
        StripePayoutExportEndpoint.queue.push(item)

        // Schedule
        QueueHandler.schedule('stripe-payout-export', async () => {
            const reporter = new StripePayoutReporter({
                secretKey: STAMHOOFD.STRIPE_SECRET_KEY,
            })
            let count = 0;
            reporter.callback = () => {
                count++;
                item.count = count
            }

            await reporter.build(start, end);
            await reporter.sendEmail()

            // Remove from queue
            StripePayoutExportEndpoint.queue.splice(StripePayoutExportEndpoint.queue.indexOf(item), 1)
        }).catch((e) => {
            console.error(e)
            StripePayoutExportEndpoint.queue.splice(StripePayoutExportEndpoint.queue.indexOf(item), 1)
        });
        
        return new Response(undefined);
    }
}
