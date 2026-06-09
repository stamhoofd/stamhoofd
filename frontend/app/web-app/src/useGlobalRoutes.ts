import type { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, NavigationController, onCheckRoutes, UrlHelper, useModalStackComponent } from '@simonbackx/vue-app-navigation';
import ForgotPasswordResetView from '@stamhoofd/components/auth/ForgotPasswordResetView.vue';
import { GlobalEventBus } from '@stamhoofd/components/EventBus.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import PaymentPendingView from '@stamhoofd/components/payments/PaymentPendingView.vue';
import PaymentSuccessView from '@stamhoofd/components/payments/PaymentSuccessView.vue';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import { Storage } from '@stamhoofd/networking/Storage';
import { EmailAddressSettings, Platform } from '@stamhoofd/structures';
import type { PaymentGeneral } from '@stamhoofd/structures';
import { PaymentStatus } from '@stamhoofd/structures';

let didCheckGlobalRoutes = false;
const SGV_OAUTH_SAVED_REDIRECT_URL_STORAGE_KEY = 'sgv-saved-redirect-url';
const SGV_OAUTH_CALLBACK_CODE_STORAGE_KEY = 'sgv-callback-code';
const SGV_OAUTH_CALLBACK_STATE_STORAGE_KEY = 'sgv-callback-state';

export function useGlobalRoutes() {
    const modalStackComponent = useModalStackComponent();
    const context = useContext();

    defineRoutes([
        {
            url: 'reset-password',
            component: () => ForgotPasswordResetView,
            paramsToProps(_params, query?: URLSearchParams) {
                return {
                    token: query?.get('token') || '',
                };
            },
            propsToParams(props: any) {
                const query = new URLSearchParams();
                if (props.token) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    query.set('token', (props as any).token);
                }
                return {
                    params: {},
                    query,
                };
            },
        },
    ]);

    const present = async (component: ComponentWithProperties) => {
        const currentPath = UrlHelper.shared.getPath({ removeLocale: true });
        await modalStackComponent.value?.present({
            adjustHistory: true,
            animated: false,
            force: true,
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: component,
                }, {
                    provide: {
                        reactive_navigation_url: currentPath,
                    },
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    };

    onCheckRoutes(async () => {
        if (didCheckGlobalRoutes) {
            // When switching root components, the routes are rechecked, so we need to prevent rechecks on these routes
            return;
        }
        didCheckGlobalRoutes = true;
        const currentPath = UrlHelper.shared.getPath({ removeLocale: true });
        const parts = UrlHelper.shared.getParts();
        const queryString = UrlHelper.shared.getSearchParams();
        console.log('Checking global routes', parts, queryString, currentPath);

        if (parts[0] === 'oauth' && parts[1] === 'sgv') {
            const code = queryString.get('code');
            const state = queryString.get('state');
            if (code && state) {
                await Storage.keyValue.setItem(SGV_OAUTH_CALLBACK_CODE_STORAGE_KEY, code);
                await Storage.keyValue.setItem(SGV_OAUTH_CALLBACK_STATE_STORAGE_KEY, state);
            }

            const savedRedirectUrl = await Storage.keyValue.getItem(SGV_OAUTH_SAVED_REDIRECT_URL_STORAGE_KEY);
            window.location.replace(savedRedirectUrl || '/beheerders/instellingen/ledenadministratie');
            return;
        }

        if (queryString.get('paymentId')) {
            const paymentId = queryString.get('paymentId');
            const organizationId = queryString.get('organizationId');
            const cancel = queryString.get('cancel') === 'true';

            if (paymentId) {
                await present(new ComponentWithProperties(PaymentPendingView, {
                    server: organizationId ? context.value.getOptionalAuthenticatedServerForOrganization(organizationId) : context.value.optionalAuthenticatedServer,
                    paymentId,
                    cancel,
                    errorHandler: async function (navigationActions: NavigationActions, error: unknown) {
                        await navigationActions.dismiss({ force: true });
                        CenteredMessage.fromError(error).addCloseButton().show();
                    },
                    finishedHandler: async function (navigationActions: NavigationActions, payment: PaymentGeneral | null) {
                        GlobalEventBus.sendEvent('paymentPatch', payment).catch(console.error);

                        if (payment && payment.status === PaymentStatus.Succeeded) {
                            await navigationActions.show({
                                components: [
                                    new ComponentWithProperties(PaymentSuccessView, {
                                        payment,
                                    }),
                                ],
                                replace: 100, // autocorrects to all
                                force: true,
                            });
                        } else {
                            await navigationActions.dismiss({ force: true });
                            new CenteredMessage($t(`%Je`), $t(`%Jf`)).addCloseButton().show();
                        }
                    },
                }));
            }
        }

        const initialParts = UrlHelper.initial.getParts();
        const initialQueryString = UrlHelper.initial.getSearchParams();

        if (initialParts.length === 1 && initialParts[0] === 'unsubscribe') {
            const id = initialQueryString.get('id');
            const token = initialQueryString.get('token');
            const type = initialQueryString.get('type') ?? 'all';

            if (id && token && ['all', 'marketing'].includes(type)) {
                await unsubscribe(id, token, type as 'all' | 'marketing');
            }
        }

        await context.value.checkSSO();
    });
}

async function unsubscribe(id: string, token: string, type: 'all' | 'marketing') {
    const toast = new Toast($t(`%Ib`), 'spinner').setHide(null).show();

    try {
        const response = await NetworkManager.server.request({
            method: 'GET',
            path: '/email/manage',
            query: {
                id,
                token,
            },
            decoder: EmailAddressSettings as Decoder<EmailAddressSettings>,
        });

        const details = response.data;
        toast.hide();

        let doUnsubscribe = true;
        const fieldName = type === 'all' ? 'unsubscribedAll' : 'unsubscribedMarketing';

        if (details[fieldName]) {
            if (!await CenteredMessage.confirm($t(`%Ic`), $t(`%Id`), $t(`%Ie`, { name: details.organization?.name ?? Platform.shared.config.name, email: details.email, complaintEmail: $t('%W') }))) {
                return;
            }

            doUnsubscribe = false;
        } else {
            if (!await CenteredMessage.confirm($t(`%If`), $t(`%Ig`), $t(`%Ih`, { name: details.organization?.name ?? Platform.shared.config.name, email: details.email }))) {
                return;
            }
            toast.show();
        }

        await NetworkManager.server.request({
            method: 'POST',
            path: '/email/manage',
            body: {
                id,
                token,
                [fieldName]: doUnsubscribe,
            },
        });
        toast.hide();

        if (doUnsubscribe) {
            new Toast($t(`%Ii`), 'success').setHide(15 * 1000).show();
        } else {
            new Toast($t(`%Ij`), 'success').setHide(15 * 1000).show();
        }
    } catch (e) {
        console.error(e);
        toast.hide();
        Toast.fromError(e).show();
    }
}
