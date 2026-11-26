import type { Decoder } from '@common/encoding';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import {
    BelcotaxConnectRequest,
    BelcotaxConnectResponse,
} from '@stamhoofd/structures/belcotax/BelcotaxConnection.js';

import { BelcotaxConnectionService } from '../../../../services/belcotax/connection/BelcotaxConnectionService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = BelcotaxConnectRequest;
type ResponseBody = BelcotaxConnectResponse;

/**
 * Starts the login of a legal representative at FOD Financiën for one company of the organization
 */
export class BelcotaxConnectEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = BelcotaxConnectRequest as Decoder<BelcotaxConnectRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/belcotax/connect', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization, user } = await BelcotaxConnectionService.authenticate();
        const authorizeUrl = await BelcotaxConnectionService.startConnect(
            organization,
            user,
            request.body,
        );
        return new Response(BelcotaxConnectResponse.create({ authorizeUrl }));
    }
}
