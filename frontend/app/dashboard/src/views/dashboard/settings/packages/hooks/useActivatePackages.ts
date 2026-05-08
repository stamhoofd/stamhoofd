import type { Decoder } from '@simonbackx/simple-encoding';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequestOwner } from '@stamhoofd/networking';
import { CheckoutResponse  } from '@stamhoofd/structures';
import type {PackageCheckout} from '@stamhoofd/structures';

export function useActivatePackages() {
    const context = useContext();
    const owner = useRequestOwner()

    async function activatePackages(checkout: PackageCheckout) {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/billing/activate-packages',
            body: checkout,
            shouldRetry: false,
            timeout: 60_000,
            owner,
            decoder: CheckoutResponse as Decoder<CheckoutResponse>
        });

        if (!checkout.proForma) {
            await context.value.fetchOrganization(false);
        }

        return response.data;
    }

    return activatePackages;
}
