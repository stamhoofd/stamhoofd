import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { UitpasNumberDetails, UitpasNumbersGetDetailsRequest } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleErrors } from '@simonbackx/simple-errors';
import { uitpasApiResponseToSocialTariff } from '../../../helpers/updateMemberDetailsUitpasNumber.js';
import { UitpasService } from '../../../services/uitpas/UitpasService.js';
import { UitpasNumberSuccessfulResponse } from '../../../services/uitpas/checkUitpasNumbers.js';

type Params = Record<string, never>;
type Query = UitpasNumbersGetDetailsRequest;
type Body = undefined;
type ResponseBody = UitpasNumberDetails[];

/**
 * Get the details such as the social tariff for a list of uitpas numbers.
 */
export class GetUitpasNumberDetailsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = UitpasNumbersGetDetailsRequest as Decoder<UitpasNumbersGetDetailsRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/uitpas/details', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const uitpasNumbers: string[] = request.query.uitpasNumbers;

        const results: UitpasNumberDetails[] = [];
        const simpleErrors = new SimpleErrors();

        for (let i = 0; i < uitpasNumbers.length; i++) {
            const uitpasNumber = uitpasNumbers[i];

            const result = await UitpasService.checkUitpasNumber(uitpasNumber);
            const response: UitpasNumberSuccessfulResponse | undefined = result.response;

            if (response) {
                const socialTariff = uitpasApiResponseToSocialTariff(response);
                results.push(UitpasNumberDetails.create({
                    uitpasNumber,
                    socialTariff,
                }));
            }
            else {
                const e = result.error!;
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace(i.toString());
                    e.addNamespace('uitpasNumbers');
                    simpleErrors.addError(e);
                }
                else {
                    throw e;
                }
            }
        }

        if (simpleErrors.errors.length > 0) {
            throw simpleErrors;
        }

        return new Response(results);
    }
}
