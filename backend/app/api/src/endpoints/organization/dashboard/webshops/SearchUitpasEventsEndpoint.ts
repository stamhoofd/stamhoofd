import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { UitpasService } from '../../../../services/uitpas/UitpasService.js';
import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Context } from '../../../../helpers/Context.js';
import { UitpasEventsResponse } from '@stamhoofd/structures';
import { SimpleError } from '@simonbackx/simple-errors';

type Params = Record<string, never>;
class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    text: string;
}
type Body = undefined;
type ResponseBody = UitpasEventsResponse;

export class SearchUitpasEventsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/search-uitpas-events', {});

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

        if (!organization.meta.uitpasOrganizerId) {
            throw new SimpleError({
                code: 'no_uitpas_organizer_id',
                message: `No UiTPAS organizer ID set for organization`,
                human: $t(`aaf56535-c13b-4f92-9ba4-7309cae3e078`),
            });
        }
        const uitpasOrganizersResponse = await UitpasService.searchUitpasEvents(organization.id, organization.meta.uitpasOrganizerId, request.query.text);

        return new Response(uitpasOrganizersResponse);
    }
}
