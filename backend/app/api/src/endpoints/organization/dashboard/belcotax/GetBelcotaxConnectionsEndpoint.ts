import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { BelcotaxConnection } from '@stamhoofd/models';
import type { BelcotaxConnection as BelcotaxConnectionStruct } from '@stamhoofd/structures/belcotax/BelcotaxConnection.js';

import { BelcotaxConnectionService } from '../../../../services/belcotax/connection/BelcotaxConnectionService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = BelcotaxConnectionStruct[];

export class GetBelcotaxConnectionsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(
            request.url,
            '/organization/belcotax/connections',
            {},
        );

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const { organization } = await BelcotaxConnectionService.authenticate();
        const connections = await BelcotaxConnection.select()
            .where('organizationId', organization.id)
            .fetch();
        return new Response(connections.map((c) => c.getStructure()));
    }
}
