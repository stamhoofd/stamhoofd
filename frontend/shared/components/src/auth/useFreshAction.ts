import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useContext } from '#hooks/useContext.ts';
import type { NavigationActions } from '#types/NavigationActions.ts';

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
    const $context = useContext();

    return async function runFresh<T>(action: () => Promise<T>): Promise<T> {
        try {
            return await action();
        } catch (e) {
            if ((isSimpleError(e) || isSimpleErrors(e)) && e.hasCode('require_fresh_auth')) {
                await $context.value.renewToken();
                const c = await new Promise<boolean>((resolve, reject) => {
                    present({
                        components: [
                            // Two-factor authentication adds views on top of the first one. They
                            // need a navigation controller of their own, because a sheet only gets
                            // one on a wide screen: without it they are pushed onto the stack that
                            // holds the sheet itself, and dismissing steps back one view instead
                            // of closing the flow.
                            new ComponentWithProperties(NavigationController, {
                                root: AsyncComponent(() => import('./ReauthenticateView.vue'), {
                                    // We opened this flow in a sheet, so we are the one that closes
                                    // it again - using the actions of the view that finished it,
                                    // which can sit deeper than the root of the sheet.
                                    onAuthenticated: async (navigation: NavigationActions) => {
                                        await navigation.dismiss({ force: true });
                                        resolve(true);
                                    },
                                    onCancel: (error?: Error) => {
                                        if (error) {
                                            reject(error);
                                            return;
                                        }
                                        resolve(false);
                                    },
                                }),
                            }),
                        ],
                        modalDisplayStyle: 'sheet',
                    }).catch(reject);
                });
                if (!c) {
                    throw new SimpleError({
                        code: 'authentication_required',
                        message: $t('%Zh6'),
                    });
                }
                return await action();
            }
            throw e;
        }
    };
}
