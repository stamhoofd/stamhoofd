import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { UitpasNumberDetails, UitpasNumbersGetDetailsRequest } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { uitpasApiResponseToSocialTariff } from '../../../helpers/updateMemberDetailsUitpasNumber.js';
import { UitpasService } from '../../../services/uitpas/UitpasService.js';

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
        if (uitpasNumbers.length > 5) {
            throw new SimpleError({
                code: 'maximum_limit',
                message: 'Please only request up to 5 numbers at the same time',
            });
        }

        const results: UitpasNumberDetails[] = [];
        const simpleErrors = new SimpleErrors();

        for (let i = 0; i < uitpasNumbers.length; i++) {
            const uitpasNumber = uitpasNumbers[i];

            try {
                const result = await UitpasService.getPassByUitpasNumber(uitpasNumber);
                const socialTariff = uitpasApiResponseToSocialTariff(result);
                results.push(UitpasNumberDetails.create({
                    uitpasNumber,
                    socialTariff,
                }));
            }
            catch (error) {
                if (isSimpleError(error) || isSimpleErrors(error)) {
                    error.addNamespace(i.toString());
                    error.addNamespace('uitpasNumbers');
                    simpleErrors.addError(error);
                }
                else {
                    throw error;
                }
            }
        }

        if (simpleErrors.errors.length > 0) {
            throw simpleErrors;
        }

        return new Response(results);
    }
}
