import { Request } from '@simonbackx/simple-networking';
import { UitpasNumbersValidationRequest, UitpasNumbersValidationResponse } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { useRequestOwner } from '@stamhoofd/networking';
import { useContext } from '../hooks';

export function useValidateUitpasNumbers() {
    const context = useContext();
    const owner = useRequestOwner();

    const validateUitpasNumbers = async (uitpasNumbers: string[]): Promise<void> => {
        // verify the UiTPAS numbers are valid for social tariff (call to backend)
        try {
            // will throw if one of the uitpas numbers is invalid
            await context.value.optionalAuthenticatedServer.request({
                method: 'POST',
                path: '/uitpas/validate',
                owner: owner,
                shouldRetry: false,
                body: UitpasNumbersValidationRequest.create({
                    uitpasNumbers,
                }),
                decoder: UitpasNumbersValidationResponse as Decoder<UitpasNumbersValidationResponse>,
            });
        }
        catch (e) {
            if (!Request.isAbortError(e)) {
                throw e;
            }

            throw new SimpleError({
                code: 'network_abort',
                message: $t('Het kansentarief kon niet gevalideerd worden. Probeer het later opnieuw.'),
            });
        }
    };

    return {
        validateUitpasNumbers,
    };
}
