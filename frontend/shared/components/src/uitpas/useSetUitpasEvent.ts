import { Product, ProductPrice, UitpasEventResponse } from '@stamhoofd/structures';

import { SimpleError } from '@simonbackx/simple-errors';
import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { nextTick, Ref } from 'vue';
import { useGetOfficialUitpasSocialTariff } from './useGetOfficialUitpasSocialTariff';

type EventResponse = {
    '@id': string;
    'name': {
        nl: string;
    };
    'location': {
        name: {
            nl: string;
        };
    };
    'startDate'?: string;
    'endDate'?: string;
};

function assertIsEventResponse(json: unknown): asserts json is EventResponse {
    if (
        typeof json !== 'object'
        || json === null
        || !('@id' in json)
        || typeof json['@id'] !== 'string'
        || !('name' in json)
        || typeof json.name !== 'object'
        || json.name === null
        || !('nl' in json.name)
        || typeof json.name.nl !== 'string'
        || !('location' in json)
        || typeof json.location !== 'object'
        || json.location === null
        || !('name' in json.location)
        || typeof json.location.name !== 'object'
        || json.location.name === null
        || !('nl' in json.location.name)
        || typeof json.location.name.nl !== 'string'
        || (('startDate' in json) && (typeof json.startDate !== 'string' || json.startDate === ''))
        || ('endDate' in json && (typeof json.endDate !== 'string' || json.endDate === ''))
    ) {
        console.error('Invalid event response', json);
        throw new SimpleError({
            code: 'invalid_event_response',
            message: `Invalid event response`,
            human: $t(`5696e0d8-a405-4087-b9bb-4bda3c9baab1`),
        });
    }
}

export function useSetUitpasEvent(patchedProduct: Ref<Product>, addProductPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<Product>>) => void) {
    const { getOfficialUitpasSocialTariff } = useGetOfficialUitpasSocialTariff();

    const getUitpasEventDetails = async (eventUrl: string): Promise<UitpasEventResponse> => {
        const response = await fetch(eventUrl).catch(() => {
            throw new SimpleError({
                code: 'fetch_error_getting_uitpas_event_details',
                message: `Error fetching Uitpas event details`,
                human: $t(`5696e0d8-a405-4087-b9bb-4bda3c9baab1`),
            });
        });

        if (!response.ok) {
            throw new SimpleError({
                code: 'invalid_response_getting_uitpas_event_details',
                message: `Invalid response when getting Uitpas event details`,
                human: $t(`5696e0d8-a405-4087-b9bb-4bda3c9baab1`),
            });
        }
        const json = await response.json().catch(() => {
        // Handle JSON parsing errors
            throw new SimpleError({
                code: 'json_parsing_error_getting_uitpas_event_details',
                message: `Error parsing JSON when getting Uitpas event details`,
                human: $t(`5696e0d8-a405-4087-b9bb-4bda3c9baab1`),
            });
        });

        assertIsEventResponse(json);
        const eventResponse = new UitpasEventResponse();
        eventResponse.url = json['@id'];
        eventResponse.name = json.name.nl;
        eventResponse.location = json.location.name.nl;
        if (json.startDate) {
            eventResponse.startDate = new Date(json.startDate);
        }
        if (json.endDate) {
            eventResponse.endDate = new Date(json.endDate);
        }
        return eventResponse;
    };

    const setUitpasEventUrl = async (newUrl: string | null): Promise<void> => {
        const details = newUrl ? await getUitpasEventDetails(newUrl) : null;

        await setUitpasEvent(details);
    };

    const setUitpasEvent = async (uitpasEvent: UitpasEventResponse | null): Promise<void> => {
        // store the new details
        addProductPatch({ uitpasEvent });
        await nextTick();

        if (uitpasEvent) {
            const uitpasTariffs = patchedProduct.value.prices.filter(p => !!p.uitpasBaseProductPriceId);
            for (const p of uitpasTariffs) {
                const basePrices = patchedProduct.value.prices.filter(basePrice => basePrice.id === p.uitpasBaseProductPriceId);
                if (basePrices.length !== 1) {
                    console.error('Expected exactly one base price for uitpas tariff', p, basePrices);
                    if (basePrices.length < 1) {
                        continue; // Skip this tariff if the base price is not found
                    }
                }
                const basePrice = basePrices[0].price;
                const newReducedPrice = await getOfficialUitpasSocialTariff(uitpasEvent.url, basePrice);
                const patch = ProductPrice.patch({ id: p.id, price: newReducedPrice });
                const produchtPatch = Product.patch({ id: patchedProduct.value.id });
                produchtPatch.prices.addPatch(patch);
                addProductPatch(produchtPatch);
                await nextTick();
            }
        }
    };

    const clearUitpasEvent = async () => {
        // remove uitpas event
        addProductPatch({ uitpasEvent: null });
        await nextTick();
    };

    return {
        setUitpasEventUrl,
        setUitpasEvent,
        clearUitpasEvent,
    };
}
