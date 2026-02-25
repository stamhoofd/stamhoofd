import { Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { UitpasGetClientIdResponse } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';
import { UitpasService } from '../../../../services/uitpas/UitpasService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = UitpasGetClientIdResponse;

export class GetUitpasClientIdEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/uitpas-client-id', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle() {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.hasFullAccess(organization.id)) {
            throw Context.auth.error();
        }

        const resp = new UitpasGetClientIdResponse();
        resp.clientId = await UitpasService.getClientIdFor(organization.id);
        return new Response(resp);
    }
}
