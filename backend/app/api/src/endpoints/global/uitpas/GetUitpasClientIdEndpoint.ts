import { Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { UitpasGetClientIdResponse } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context';
import { UitpasService } from '../../../services/uitpas/UitpasService';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = UitpasGetClientIdResponse;

export class GetUitpasClientIdEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/uitpas/client-id', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle() {
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        let orgId: string | null;
        if (organization) {
            if (!await Context.auth.hasFullAccess(organization.id)) {
                throw Context.auth.error();
            }
            orgId = organization.id;
        }
        else {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error();
            }
            orgId = null;
        }

        const resp = new UitpasGetClientIdResponse();
        const { clientId, useTestEnv } = await UitpasService.getClientIdFor(orgId);
        resp.clientId = clientId;
        resp.useTestEnv = useTestEnv;
        return new Response(resp);
    }
}
