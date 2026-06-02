import { ComponentWithProperties, defineRoutes, NavigationController, onCheckRoutes, UrlHelper, useModalStackComponent, usePresent } from '@simonbackx/vue-app-navigation';
import ForgotPasswordResetView from '@stamhoofd/components/auth/ForgotPasswordResetView.vue';
import { GlobalEventBus } from '@stamhoofd/components/EventBus.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import PaymentPendingView from '@stamhoofd/components/payments/PaymentPendingView.vue';
import PaymentSuccessView from '@stamhoofd/components/payments/PaymentSuccessView.vue';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import type { PaymentGeneral } from '@stamhoofd/structures';
import { PaymentStatus } from '@stamhoofd/structures';

let didCheckGlobalRoutes = false;
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
    });
}
