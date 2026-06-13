import type { CountFilteredRequest } from '@stamhoofd/structures';
import { useContext } from '../../hooks/useContext';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';

export function useChargeReceivableBalances() {
    const context = useContext();
    const owner = useRequestOwner();

    return async function charge(selection: CountFilteredRequest) {
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/receivable-balances/charge',
            body: selection,
            owner,
            shouldRetry: false,
            timeout: 60_000,
        })
    }
}
