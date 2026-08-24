import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { User } from '@stamhoofd/models';
import type { ImpersonationTicket } from '@stamhoofd/structures';
import { StartImpersonationRequest } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { ImpersonationService } from '../../services/ImpersonationService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = StartImpersonationRequest;
type ResponseBody = ImpersonationTicket;

/**
 * Hand an administrator a one-time link that signs them in as another user.
 */
export class StartImpersonationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = StartImpersonationRequest as Decoder<StartImpersonationRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/impersonation', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // Scoped like the rest of administrator management: permissions are organization
        // bound, and this is reached from the administrators of one organization.
        await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        const impersonatedUser = await User.getByID(request.body.userId);

        if (!impersonatedUser) {
            // Deliberately the same answer the service gives for an account that exists but
            // may not be impersonated, so this cannot be used to find out which user ids
            // exist.
            throw Context.auth.error({
                message: 'Not allowed to impersonate this user',
                human: $t(`Je hebt geen toegang om aan te melden als deze gebruiker.`),
            });
        }

        return new Response(
            await ImpersonationService.createTicket(impersonatedUser),
        );
    }
}
