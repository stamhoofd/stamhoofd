import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { ImpersonationTicketGrant, Token as TokenStruct } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { ImpersonationService } from '../../services/ImpersonationService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = ImpersonationTicketGrant;
type ResponseBody = TokenStruct;

/**
 * Trade the one-time ticket of an impersonation link for a session.
 *
 * Unauthenticated on purpose: the link is opened in a private window, which by design has
 * no session of its own. The ticket carries the whole proof (see ImpersonationService).
 */
export class RedeemImpersonationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = ImpersonationTicketGrant as Decoder<ImpersonationTicketGrant>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/impersonation/token', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope({ willAuthenticate: false });

        const token = await ImpersonationService.redeemTicket(request.body.ticket);

        return new Response(new TokenStruct(token));
    }
}
