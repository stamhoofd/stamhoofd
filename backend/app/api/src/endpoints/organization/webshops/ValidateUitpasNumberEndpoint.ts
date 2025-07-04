import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { UitpasPriceCheckRequest, UitpasPriceCheckResponse } from '@stamhoofd/structures';

import { UitpasNumberValidator } from '../../../helpers/UitpasNumberValidator';
import { Decoder } from '@simonbackx/simple-encoding';
type Params = Record<string, never>;
type Query = undefined;
type Body = UitpasPriceCheckRequest;
type ResponseBody = UitpasPriceCheckResponse;

export class ValidateUitpasNumberEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = UitpasPriceCheckRequest as Decoder<UitpasPriceCheckRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/uitpas', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        if (request.body.uitpasEventId) {
            // offical flow -> price is the base price!
            // const basePrice = request.body.price;

            throw new SimpleError({
                code: 'not_implemented',
                message: 'Official flow not yet implemented',
                human: $t(`De officiële flow voor het valideren van een UiTPAS-nummer wordt nog niet ondersteund.`),
            });
        }
        // non-offical flow -> price is the reduced price!
        const reducedPrice = request.body.price;
        await UitpasNumberValidator.checkUitpasNumber(request.body.uitpasNumber as string);
        const uitpasPriceCheckResponse = UitpasPriceCheckResponse.create({
            price: reducedPrice,
        });
        return new Response(uitpasPriceCheckResponse);
    }
}
