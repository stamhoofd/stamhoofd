import type { Decoder } from '@common/encoding';
import { useRequestOwner } from '@stamhoofd/components/hooks/networking/useRequestOwner';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { Storage } from '@stamhoofd/frontend-storage/Storage';
import { UrlHelper } from '@stamhoofd/networking/UrlHelper';
import { BelcotaxConnectRequest, BelcotaxConnectResponse } from '@stamhoofd/structures/belcotax/BelcotaxConnection.js';

const stateStorageKey = 'belcotax-connect-state';
const resultParameters = ['belcotax_result', 'belcotax_error', 'belcotax_state'];

export function currentUrlWithoutBelcotaxResult() {
    const url = new URL(window.location.href);
    for (const parameter of resultParameters) {
        url.searchParams.delete(parameter);
    }
    return url;
}

/**
 * Connecting a company sends the browser to the login of FOD Financiën, which returns to `returnUrl` with the
 * result in the URL. Call `checkResult` when that page loads.
 */
export function useBelcotaxConnect() {
    const context = useContext();
    const owner = useRequestOwner();

    async function connect(companyId: string, returnUrl: URL = currentUrlWithoutBelcotaxResult()) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const spaState = btoa(String.fromCharCode(...bytes));
        await Storage.keyValue.setItem(stateStorageKey, spaState);

        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/organization/belcotax/connect',
            body: BelcotaxConnectRequest.create({
                companyId,
                redirectUri: returnUrl.href,
                spaState,
            }),
            decoder: BelcotaxConnectResponse as Decoder<BelcotaxConnectResponse>,
            owner,
            shouldRetry: false,
        });
        window.location.href = response.data.authorizeUrl;
    }

    /**
     * Shows the result once, and only for a connection this browser started
     */
    async function checkResult(): Promise<'connected' | 'error' | null> {
        const search = UrlHelper.initial.getSearchParams();
        const result = search.get('belcotax_result');
        if (!result) {
            return null;
        }

        const savedState = await Storage.keyValue.getItem(stateStorageKey);
        if (!savedState || savedState !== search.get('belcotax_state')) {
            return null;
        }
        await Storage.keyValue.removeItem(stateStorageKey);

        const url = currentUrlWithoutBelcotaxResult();
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);

        if (result === 'connected') {
            new Toast($t('De verbinding met Belcotax is gelukt'), 'success green').show();
            return 'connected';
        }
        new CenteredMessage($t('Verbinden met Belcotax is niet gelukt'), search.get('belcotax_error') ?? '', 'error')
            .addCloseButton()
            .show();
        return 'error';
    }

    return { connect, checkResult };
}
