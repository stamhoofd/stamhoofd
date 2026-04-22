import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { CountFilteredRequest, CountResponse } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context.js';
import { GetGroupsEndpoint } from './GetGroupsEndpoint.js';

type Params = Record<string, never>;
type Query = CountFilteredRequest;
type Body = undefined;
type ResponseBody = CountResponse;

export class GetGroupsCountEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = CountFilteredRequest as Decoder<CountFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/groups/count', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        await Context.optionalAuthenticate();

        if (!organization) {
            if (!Context.auth.hasSomePlatformAccess()) {
                throw Context.auth.error();
            }
        }
        
        const query = await GetGroupsEndpoint.buildQuery(request.query);

        const count = await query
            .count();

        return new Response(
            CountResponse.create({
                count,
            }),
        );
    }
}
