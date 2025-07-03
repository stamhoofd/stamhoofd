import { ArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Webshop, WebshopDiscountCode } from '@stamhoofd/models';
import { DiscountCode } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context';

type Params = { id: string };
type Query = undefined;
type Body = string[];
type ResponseBody = DiscountCode[];

export class CheckWebshopDiscountCodesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new ArrayDecoder(StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/webshop/@id/discount-codes', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope({ willAuthenticate: false });
        const webshop = await Webshop.getByID(request.params.id);
        if (!webshop || webshop.organizationId !== organization.id) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Webshop not found',
                human: $t(`45c039cd-e937-42cd-934b-a2bb4ee0abdd`),
            });
        }

        if (request.body.length > 10) {
            // Auto limit
            request.body = request.body.slice(0, 10);
        }

        // Check all discount codes
        // Return all valid ones
        if (request.body.length > 0) {
            const codes = await WebshopDiscountCode.getActiveCodes(webshop.id, request.body);

            // todo
            return new Response(
                codes.map(c => c.getStructure()),
            );
        }

        return new Response([]);
    }
}
