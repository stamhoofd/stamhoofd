import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { UitpasPriceCheckRequest, UitpasPriceCheckResponse } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { Context } from '../../../helpers/Context.js';
import { UitpasService } from '../../../services/uitpas/UitpasService.js';

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
        if (request.body.uitpasEventUrl) {
            // OFFICIAL FLOW
            if (!request.body.uitpasNumbers) {
                // STATIC CHECK
                // request shouldn't include a reduced price

                // this call should be authenticated, as it is done from the webshop settings
                const organization = await Context.setOrganizationScope({ willAuthenticate: true });
                await Context.authenticate();
                const reducedPrice = await UitpasService.getSocialTariffForEvent(
                    organization.id,
                    request.body.basePrice,
                    request.body.uitpasEventUrl,
                );
                const uitpasPriceCheckResponse = UitpasPriceCheckResponse.create({
                    prices: [reducedPrice], // Convert to cents
                });
                return new Response(uitpasPriceCheckResponse);
            }
            else {
                // OFFICIAL FLOW with an UiTPAS number
                // request should include a reduced price (estimate by the frontend)
                const organization = await Context.setOrganizationScope({ willAuthenticate: false });
                const reducedPrices = await UitpasService.getSocialTariffForUitpasNumbers(organization.id, request.body.uitpasNumbers, request.body.basePrice, request.body.uitpasEventUrl); // Throws if invalid
                const uitpasPriceCheckResponse = UitpasPriceCheckResponse.create({
                    prices: reducedPrices.map(price => price.price), // ignore tariff id's here
                });
                return new Response(uitpasPriceCheckResponse);
            }
        }
        else {
            // NON-OFFICIAL FLOW
            // request should include UiTPAS-numbers, reduced price AND base price
            if (request.body.reducedPrice === null) {
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
            await UitpasService.checkUitpasNumbers(request.body.uitpasNumbers); // Throws if invalid
            const uitpasPriceCheckResponse = UitpasPriceCheckResponse.create({
                prices: request.body.uitpasNumbers.map(_ => reducedPrice), // All reduced prices are the same in this non-official flow
            });
            return new Response(uitpasPriceCheckResponse);
        }
    }
}
