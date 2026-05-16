import type { Decoder } from '@simonbackx/simple-encoding';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequestOwner } from '@stamhoofd/networking';
import type { OrganizationCheckout } from '@stamhoofd/structures';
import { CheckoutResponse } from '@stamhoofd/structures';

export function useCheckoutOrganizationCheckout() {
    const context = useContext();
    const owner = useRequestOwner()

    async function checkoutOrganizationCheckout(sellingOrganizationId: string, checkout: OrganizationCheckout, options?: {shouldRetry?: boolean, owner?: any}) {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/billing/'+sellingOrganizationId+'/checkout',
            body: checkout,
            shouldRetry: options?.shouldRetry ?? false,
            timeout: 60_000,
            owner: options?.owner ?? owner,
            decoder: CheckoutResponse as Decoder<CheckoutResponse>
        });

        if (!checkout.proForma) {
            await context.value.fetchOrganization(false);
        }

        return response.data;
    }

    return checkoutOrganizationCheckout;
}
