import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { UitpasPriceCheckRequest, UitpasPriceCheckResponse } from '@stamhoofd/structures';

import { UitpasNumberValidator } from '../../../helpers/UitpasNumberValidator';
import { Decoder } from '@simonbackx/simple-encoding';
type Params = Record<string, never>;
type Query = undefined;
type Body = UitpasPriceCheckRequest;
type ResponseBody = UitpasPriceCheckResponse;

export class retrieveUitpasSocialTariffPrice extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = UitpasPriceCheckRequest as Decoder<UitpasPriceCheckRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
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
            // OFFICIAL FLOW
            if (!request.body.uitpasNumber) {
                // STATIC CHECK
                // request shouldn't include a reduced price
            }
            else {
                // OFFICIAL FLOW with an UiTPAS number
                // request should include a reduced price (estimate by the frontend)
            }
            throw new SimpleError({
                code: 'not_implemented',
                message: 'Official flow not yet implemented',
                human: 'De officiële flow voor het valideren van een UiTPAS-nummer wordt nog niet ondersteund.',
            });
        }
        else {
            // NON-OFFICIAL FLOW
            // request should include reduced price AND base price
            if (!request.body.reducedPrice) {
                throw new SimpleError({
                    code: 'missing_reduced_price',
                    message: 'Reduced price must be provided for non-official flow.',
                    human: $t('Je moet een verlaagd tarief opgeven voor de UiTPAS.'),
                });
            }
            await UitpasNumberValidator.checkUitpasNumber(request.body.uitpasNumber);
            const uitpasPriceCheckResponse = UitpasPriceCheckResponse.create({
                price: request.body.reducedPrice,
            });
            return new Response(uitpasPriceCheckResponse);
        }
    }
}
