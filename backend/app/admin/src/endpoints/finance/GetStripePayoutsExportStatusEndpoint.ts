import { AutoEncoder, DateDecoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";

import { AdminToken } from '../../models/AdminToken';
import { StripePayoutExportEndpoint } from './StripePayoutsExportEndpoint';

export class PayoutExportStatus extends AutoEncoder {
    @field({ decoder: DateDecoder })
    start: Date

    @field({ decoder: DateDecoder })
    end: Date

    @field({ decoder: IntegerDecoder })
    count: number
}

type Params = Record<string, never>;
type ResponseBody = PayoutExportStatus[]
type Query = undefined;
type Body = undefined

export class GetStripePayoutsExportStatusEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/stripe/payouts/status", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await AdminToken.authenticate(request);
                
        return new Response(StripePayoutExportEndpoint.queue.map(item => {
            return PayoutExportStatus.create(item)   
        }));
    }
}
