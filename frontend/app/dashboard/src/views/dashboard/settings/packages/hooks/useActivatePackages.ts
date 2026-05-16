import { usePlatform } from '@stamhoofd/components/hooks/usePlatform';
import type { OrganizationCheckout } from '@stamhoofd/structures';
import { useCheckoutOrganizationCheckout } from './useCheckoutOrganizationCheckout.js';

export function useActivatePackages() {
    const doCheckout = useCheckoutOrganizationCheckout();
    const platform = usePlatform()

    async function activatePackages(checkout: OrganizationCheckout, options?: {shouldRetry?: boolean, owner?: any}) {
        return await doCheckout(platform.value.membershipOrganizationId!, checkout, options)
    }

    return activatePackages;
}
