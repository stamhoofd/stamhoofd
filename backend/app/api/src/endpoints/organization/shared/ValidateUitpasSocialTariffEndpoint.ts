import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { UitpasNumbersValidationRequest, UitpasNumbersValidationResponse } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { UitpasService } from '../../../services/uitpas/UitpasService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = UitpasNumbersValidationRequest;
type ResponseBody = UitpasNumbersValidationResponse;

/**
 * Check if an UiTPAS number has a valid social tariff status
 */
export class ValidateUitpasNumbersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = UitpasNumbersValidationRequest as Decoder<UitpasNumbersValidationRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/uitpas/validate', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const uitpasNumbers: string[] = request.body.uitpasNumbers;

        // Throws if invalid
        await UitpasService.checkUitpasNumbers(uitpasNumbers);

        const responseData = UitpasNumbersValidationResponse.create({
            areValid: true,
        });

        return new Response(responseData);
    }
}
