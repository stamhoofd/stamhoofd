import type { Decoder } from '@simonbackx/simple-encoding';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { DetailedPayableBalance } from '@stamhoofd/structures';

export function useLoadPayableBalance() {
        const context = useContext();
    const owner = useRequestOwner()

    // Fetch balance
    async function loadPayableBalance(sellingOrganizationId: string) {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/billing/${sellingOrganizationId}/payable-balance`,
            decoder: DetailedPayableBalance as Decoder<DetailedPayableBalance>,
            shouldRetry: false,
            owner,
        });

        return response.data;
    }

    return loadPayableBalance
}
