import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';

import { PayoutExportStatus, StripePayoutsExportEndpoint } from './StripePayoutsExportEndpoint.js';

type Params = Record<string, never>;
type Body = undefined;
type Query = undefined;
type ResponseBody = PayoutExportStatus[];

export class GetStripePayoutsExportStatusEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/stripe/payouts/status', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        await StripePayoutsExportEndpoint.authenticate();

        return new Response(StripePayoutsExportEndpoint.queue.map((item) => {
            return PayoutExportStatus.create(item);
        }));
    }
}
