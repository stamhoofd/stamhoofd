import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
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
        }
        catch (e) {
            if ((isSimpleError(e) || isSimpleErrors(e)) && e.hasCode('require_fresh_auth')) {
                await new Promise<void>((resolve, reject) => {
                    present({
                        components: [
                            AsyncComponent(() => import('./ReauthenticateView.vue'), {
                                onAuthenticated: () => {
                                    resolve();
                                },
                            }),
                        ],
                        modalDisplayStyle: 'sheet',
                    }).catch(reject);
                });
                return await action();
            }
            throw e;
        }
    };
}
