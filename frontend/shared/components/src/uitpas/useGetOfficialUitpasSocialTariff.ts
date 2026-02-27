import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { useRequestOwner } from '@stamhoofd/networking';
import { UitpasPriceCheckRequest, UitpasPriceCheckResponse } from '@stamhoofd/structures';
import { useContext } from '#hooks/useContext';
import { Decoder } from '@simonbackx/simple-encoding';

export function useGetOfficialUitpasSocialTariff() {
    const owner = useRequestOwner();
    const context = useContext();
    const getOfficialUitpasSocialTariff = async (uitpasEventUrl: string, basePrice: number): Promise<number> => {
        try {
            const response = await context.value.authenticatedServer.request({
                method: 'POST',
                path: '/uitpas',
                owner: owner,
                shouldRetry: true,
                body: UitpasPriceCheckRequest.create({
                    basePrice: basePrice,
                    reducedPrice: null,
                    uitpasNumbers: null,
                    uitpasEventUrl: uitpasEventUrl,
                }),
                decoder: UitpasPriceCheckResponse as Decoder<UitpasPriceCheckResponse>,
            });
            const reducedPrices = response.data.prices;
            if (reducedPrices.length < 1) {
                throw new SimpleError({
                    code: 'invalid_social_tariff',
                    message: 'No social tariff found received uitpas event',
                    human: $t('c8da000d-cfa8-4ceb-8ea0-87c464271eb8'),
                });
            }
            else if (reducedPrices.length > 1) {
                console.warn('Received multiple reduced prices for uitpas social tariff', reducedPrices);
            }

            return reducedPrices[0];
        }
        catch (e) {
            if (!Request.isAbortError(e)) {
                throw e;
            }
            return 0; // If the request was aborted, we return 0 as a fallback
        }
    };

    return {
        getOfficialUitpasSocialTariff,
    };
}
