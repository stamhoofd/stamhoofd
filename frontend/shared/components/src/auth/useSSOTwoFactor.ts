import { useShow } from '@simonbackx/vue-app-navigation';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import type { MFAChallengeResponse } from '@stamhoofd/structures';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useContext } from '#hooks/useContext.ts';

/**
 * Presenting the two-factor step of a login that was held back by the backend.
 *
 * A password login receives what is pending in the error response, but an SSO login ends
 * in a browser redirect that can only carry a token in the url (see
 * SessionContext.checkSSO). Every login view calls continuePendingSSOTwoFactor() on load
 * so an SSO user does not end up staring at the login form again.
 */
export function useSSOTwoFactor() {
    const show = useShow();
    const $context = useContext();

    /**
     * Completing the second factor completes the session, after which the app replaces the
     * login root with the app itself - taking this whole flow with it. Nothing left to do.
     */
    function onCompleted() {}

    /**
     * The primary credential was accepted, but a second factor is still required.
     *
     * Pushed onto the login navigation stack rather than presented as a sheet: it is the
     * next step of the login, not an interruption of it.
     */
    async function presentMfaChallenge(mfaChallenge: MFAChallengeResponse) {
        await show({
            components: [
                AsyncComponent(() => import('./ChooseMFAMethodView.vue'), {
                    mfaChallenge,
                    onCompleted,
                }),
            ],
        });
    }

    /**
     * The primary credential was accepted, but the user must enroll a second factor first.
     */
    async function presentMfaSetup(setup: { setupToken: string; canUsePasskeys: boolean }) {
        await show({
            components: [
                AsyncComponent(() => import('./SetupMFAView.vue'), {
                    setupToken: setup.setupToken,
                    canUsePasskeys: setup.canUsePasskeys,
                    onCompleted,
                }),
            ],
        });
    }

    /**
     * Pick up an SSO login that still needs a second factor.
     *
     * @returns whether something was pending. Only attempted once: on failure the user
     * falls back to the normal login view.
     */
    async function continuePendingSSOTwoFactor(): Promise<boolean> {
        const pending = $context.value.pendingSSOTwoFactor;
        if (!pending) {
            return false;
        }
        $context.value.pendingSSOTwoFactor = null;

        if ('setupToken' in pending) {
            await presentMfaSetup(pending);
            return true;
        }

        // The redirect could only carry the token, so the methods are fetched here.
        await presentMfaChallenge(await LoginHelper.fetchMfaChallenge($context.value, pending.mfaToken));
        return true;
    }

    return {
        hasPendingSSOTwoFactor: () => $context.value.pendingSSOTwoFactor !== null,
        continuePendingSSOTwoFactor,
        presentMfaChallenge,
        presentMfaSetup,
    };
}
