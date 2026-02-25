import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { UitpasService } from '../../../../services/uitpas/UitpasService.js';
import { UitpasOrganizersResponse } from '@stamhoofd/structures';
import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Context } from '../../../../helpers/Context.js';

type Params = Record<string, never>;
class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name: string;
}
type Body = undefined;
type ResponseBody = UitpasOrganizersResponse;

export class SearchUitpasOrganizersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/search-uitpas-organizers', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.hasFullAccess(organization.id)) {
            throw Context.auth.error();
        }
        const uitpasOrganizersResponse = await UitpasService.searchUitpasOrganizers(request.query.name);

        return new Response(uitpasOrganizersResponse);
    }
}
