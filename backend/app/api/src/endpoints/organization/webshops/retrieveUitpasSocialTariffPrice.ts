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
        // uitpasEventID and uitpasNumber cannot be null at the same time
        if (!request.body.uitpasEventId && !request.body.uitpasNumber) {
            throw new SimpleError({
                code: 'missing_uitpas_event_id_or_number',
                message: 'Either uitpasEventId or uitpasNumber must be provided, or both.',
                human: $t('Je moet minstens een UiTPAS evenement ID of een UiTPAS nummer opgeven.'),
            });
        }

        if (request.body.uitpasEventId) {
            // OFFICIAL FLOW -> price is the base price
            // const basePrice = request.body.price;

            if (request.body.uitpasNumber) {
                // both uitpasEventId and uitpasNumber are provided -> validate specific uitpas number
            }
            else {
                // only uitpasEventId is provided -> do a static check up (independent of uitpas number)
            }

            throw new SimpleError({
                code: 'not_implemented',
                message: 'Official flow not yet implemented',
                human: $t(`De officiële flow voor het valideren van een UiTPAS-nummer wordt nog niet ondersteund.`),
            });
        }
        // NON-OFFICIAL FLOW -> price is the reduced price
        const reducedPrice = request.body.price;
        await UitpasNumberValidator.checkUitpasNumber(request.body.uitpasNumber as string);
        const uitpasPriceCheckResponse = UitpasPriceCheckResponse.create({
            price: reducedPrice,
        });
        return new Response(uitpasPriceCheckResponse);
    }
}
