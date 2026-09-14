import type { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import type { Server } from '@simonbackx/simple-networking';
import { Request } from '@simonbackx/simple-networking';
import type { CartItem } from '@stamhoofd/structures';
import { UitpasPriceCheckRequest, UitpasPriceCheckResponse } from '@stamhoofd/structures';

/**
 * Verify the UiTPAS numbers of a cart item are valid for the social tariff and store the reduced prices on the item.
 * Throws when a number is invalid (same check as CartItemView).
 */
export async function validateUitpasNumbers(cartItem: CartItem, server: Server, owner: object) {
    if (cartItem.productPrice.uitpasBaseProductPriceId === null) {
        cartItem.uitpasNumbers = [];
        return;
    }

    const baseProductPrice = cartItem.product.prices.find(p => p.id === cartItem.productPrice.uitpasBaseProductPriceId);
    if (!baseProductPrice) {
        return;
    }

    try {
        const response = await server.request({
            method: 'POST',
            path: '/uitpas',
            owner,
            shouldRetry: false,
            body: UitpasPriceCheckRequest.create({
                basePrice: baseProductPrice.price,
                reducedPrice: cartItem.productPrice.price,
                uitpasNumbers: cartItem.uitpasNumbers.map(p => p.uitpasNumber),
                uitpasEventUrl: cartItem.product.uitpasEvent?.url ?? null, // null for non-official flow, not null for official flow
            }),
            decoder: UitpasPriceCheckResponse as Decoder<UitpasPriceCheckResponse>,
        });
        const reducedPrices = response.data.prices;
        if (reducedPrices.length < cartItem.uitpasNumbers.length) {
            // Should already be thrown by the backend
            throw new SimpleError({
                code: 'invalid_uitpas_numbers',
                message: 'Not all uitpas numbers were valid',
                human: $t('%1B5'),
            });
        }
        for (let i = 0; i < cartItem.uitpasNumbers.length; i++) {
            cartItem.uitpasNumbers[i].price = reducedPrices[i];
        }
    } catch (e) {
        if (!Request.isAbortError(e)) {
            throw e;
        }
    }
}
