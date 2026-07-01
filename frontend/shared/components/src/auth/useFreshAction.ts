import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { usePresent } from '@simonbackx/vue-app-navigation';

import { AsyncComponent } from '#containers/AsyncComponent.ts';

/**
 * Wraps a sensitive action that requires a "fresh" access token.
 *
 * When the backend responds with `require_fresh_auth`, the user re-authenticates
 * (password + 2FA) via {@link ReauthenticateView} to mint a fresh token, after which the
 * action is retried exactly once. When the token is already fresh, the action runs
 * directly with no extra prompt.
 */
export function useFreshAction() {
    const present = usePresent();

    return async function runFresh<T>(action: () => Promise<T>): Promise<T> {
        try {
            return await action();
        } catch (e) {
            if ((isSimpleError(e) || isSimpleErrors(e)) && e.hasCode('require_fresh_auth')) {
                const c = await new Promise<boolean>((resolve, reject) => {
                    present({
                        components: [
                            AsyncComponent(() => import('./ReauthenticateView.vue'), {
                                onAuthenticated: () => {
                                    resolve(true);
                                },
                                onCancel: () => {
                                    resolve(false);
                                },
                            }),
                        ],
                        modalDisplayStyle: 'sheet',
                    }).catch(reject);
                });
                if (!c) {
                    throw new SimpleError({
                        code: 'authentication_required',
                        message: $t('Voor deze actie moet je je identiteit herbevestigen'),
                    });
                }
                return await action();
            }
            throw e;
        }
    };
}
