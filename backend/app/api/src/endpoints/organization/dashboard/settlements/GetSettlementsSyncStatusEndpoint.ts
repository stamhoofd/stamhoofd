import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';

import { StripePayoutsExportEndpoint } from '../stripe/StripePayoutsExportEndpoint.js';
import { SettlementsSyncStatus } from '@stamhoofd/structures/settlements/SettlementsSyncStatus.js';

import { SettlementsSyncEndpoint } from './SettlementsSyncEndpoint.js';

type Params = Record<string, never>;
type Body = undefined;
type Query = undefined;
type ResponseBody = SettlementsSyncStatus[];

export class GetSettlementsSyncStatusEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/settlements/sync/status', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        await StripePayoutsExportEndpoint.authenticate();

        return new Response(SettlementsSyncEndpoint.queue.map((item) => {
            return SettlementsSyncStatus.create(item);
        }));
    }
}
