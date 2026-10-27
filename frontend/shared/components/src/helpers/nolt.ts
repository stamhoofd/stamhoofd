import type { Decoder } from '@common/encoding';
import { AutoEncoder, field, StringDecoder } from '@common/encoding';
import { UrlHelper } from '@simonbackx/vue-app-navigation';
import { useContext } from '#hooks/useContext.ts';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { Toast } from '#overlays/Toast.ts';
import type { SessionContext } from '@stamhoofd/frontend-session/SessionContext';
import { onBeforeUnmount, onMounted } from 'vue';

class ResponseBody extends AutoEncoder {
    @field({ decoder: StringDecoder })
    jwt: string;
}

const storageKey = 'pending-nolt-login';

const maxAge = 30 * 60 * 1000; // After 30 minutes, the intent is ignored (so no unexpected redirects happen)

export async function openNolt($context: SessionContext, check = false) {
    if (check) {
        let url: URL | null = null;
        if (document.referrer) {
            try {
                url = new URL(document.referrer);
            } catch (e) {
                console.error(e);
            }
        }

        // Request permission if coming from an untrusted domain
        if (!url || (url.hostname !== STAMHOOFD.NOLT_URL && url.hostname !== 'www.stamhoofd.be' && url.hostname !== 'www.stamhoofd.nl')) {
            if (!await CenteredMessage.confirm($t('%Ik'), $t('%Il'), $t('%Im', { email: $context.user!.email }), undefined, false)) {
                return;
            }
        }
    }

    // Create token
    const toast = new Toast($t('%In'), $t('%15')).setHide(null).show();
    try {
        const response = await $context.authenticatedServer!.request({
            method: 'POST',
            path: '/nolt/create-token',
            decoder: ResponseBody as Decoder<ResponseBody>,
            shouldRetry: false,
        });
        window.location.href = 'https://' + STAMHOOFD.NOLT_URL + '/sso/' + encodeURIComponent(response.data.jwt);
    } catch (e) {
        console.error(e);
        Toast.fromError(e).show();
    }
    toast.hide();
}

/**
 * Returns true when the page was opened via /auth/nolt and writes this intent to sessionStorage.
 */
export function rememberPendingNoltLogin(): boolean {
    if (!STAMHOOFD.NOLT_URL) {
        return false;
    }

    const parts = UrlHelper.initial.getParts();
    if (parts.length !== 2 || parts[0] !== 'auth' || parts[1] !== 'nolt') {
        return false;
    }

    try {
        sessionStorage.setItem(storageKey, Date.now().toString());
    } catch (e) {
        console.error(e);
    }
    return true;
}

/**
 * Returns true when there was a recent intent of login to Nolt. The intent is then consumed.
 */
export function consumePendingNoltLogin(): boolean {
    try {
        const value = sessionStorage.getItem(storageKey);
        if (value === null) {
            return false;
        }
        sessionStorage.removeItem(storageKey);

        const timestamp = parseInt(value);
        return !isNaN(timestamp) && Date.now() - timestamp < maxAge;
    } catch (e) {
        console.error(e);
        return false;
    }
}

/**
 * Hook that checks if there was a recent intent of login to Nolt and opens Nolt if so. The intent is then consumed.
 */
export function useOpenPendingNoltLogin() {
    if (!STAMHOOFD.NOLT_URL) {
        return;
    }

    const context = useContext().value;
    const owner = {};

    function check() {
        const permissions = context.auth.permissions;
        if (!context.isComplete() || !permissions || permissions.isEmpty) {
            // Not signed in yet, or no admin access to this organization
            // keep the intent for a later sign in that is allowed to open Nolt
            return;
        }

        if (!consumePendingNoltLogin()) {
            return;
        }

        openNolt(context, true).catch(console.error);
    }

    onMounted(() => {
        check();
        context.addListener(owner, check);
    });

    onBeforeUnmount(() => {
        context.removeListener(owner);
    });
}
