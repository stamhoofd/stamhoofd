import { Request } from '@simonbackx/simple-networking';
import { UitpasNumberDetails, UitpasNumbersGetDetailsRequest } from '@stamhoofd/structures';

import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { useRequestOwner } from '@stamhoofd/networking';
import { useContext } from '../hooks';

export function useGetUitpasNumberDetails() {
    const context = useContext();
    const owner = useRequestOwner();

    const getUitpasNumberDetails = async (uitpasNumbers: string[]): Promise<UitpasNumberDetails[]> => {
        // verify the UiTPAS numbers are valid for social tariff (call to backend)
        try {
            // will throw if one of the uitpas numbers is invalid
            const result = await context.value.optionalAuthenticatedServer.request({
                method: 'GET',
                path: '/uitpas/details',
                owner: owner,
                shouldRetry: false,
                query: new UitpasNumbersGetDetailsRequest({
                    uitpasNumbers,
                }),
                decoder: new ArrayDecoder(UitpasNumberDetails as Decoder<UitpasNumberDetails>),
                timeout: 30 * 1000,
            });

            return result.data;
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
        getUitpasNumberDetails,
    };
}
