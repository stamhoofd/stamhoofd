import { Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { UitpasGetClienIdResponse } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';
import { SimpleError } from '@simonbackx/simple-errors';
import { UitpasService } from '../../../../services/uitpas/UitpasService';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = UitpasGetClienIdResponse;

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
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        if (!organization) {
            throw new SimpleError({
                message: 'This endpoint requires an organization scope, platform scope is not implemented',
                code: 'not_implemented',
                human: $t('Deze endpoint vereist een organisatie scope, platform credentials kunnen nog niet worden ingesteld'),
            });
        }

        if (!await Context.auth.hasFullAccess(organization.id)) {
            throw Context.auth.error();
        }

        const resp = new UitpasGetClienIdResponse();
        resp.clientId = await UitpasService.getClientIdFor(organization.id);
        return new Response(resp);
    }
}
