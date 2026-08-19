import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';

import { Context } from '../../helpers/Context.js';
import { SessionService } from '../../services/SessionService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = undefined;

export class DeleteTokenEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'DELETE') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/oauth/token', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        const { token } = await Context.authenticate({ allowWithoutAccount: true });
        await SessionService.endSession(token);

        return new Response(undefined);
    }
}
