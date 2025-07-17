import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { UitpasPriceCheckRequest, UitpasPriceCheckResponse } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { UitpasService } from '../../../services/uitpas/UitpasService';
type Params = Record<string, never>;
type Query = undefined;
type Body = UitpasPriceCheckRequest;
type ResponseBody = UitpasPriceCheckResponse;

export class RetrieveUitpasSocialTariffPricesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
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
            if (!request.body.uitpasNumbers) {
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
            // request should include UiTPAS-numbers, reduced price AND base price
            if (!request.body.reducedPrice) {
                throw new SimpleError({
                    code: 'missing_reduced_price',
                    message: 'Reduced price must be provided for non-official flow.',
                    human: $t('c66d114d-2ef3-476f-ad00-98fbe3195365'),
                });
            }
            const reducedPrice = request.body.reducedPrice;
            if (!request.body.uitpasNumbers) {
                throw new SimpleError({
                    code: 'missing_uitpas_numbers',
                    message: 'Uitpas numbers must be provided for non-official flow.',
                    human: $t('f792eda7-03b9-465d-807d-3d08ba148c8b'),
                });
            }
            try {
                await UitpasService.checkUitpasNumbers(request.body.uitpasNumbers); // Throws if invalid
            }
            catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace('uitpasNumbers');
                }
                throw e;
            }
            const uitpasPriceCheckResponse = UitpasPriceCheckResponse.create({
                prices: request.body.uitpasNumbers.map(_ => reducedPrice), // All reduced prices are the same in this non-official flow
            });
            return new Response(uitpasPriceCheckResponse);
        }
    }
}
