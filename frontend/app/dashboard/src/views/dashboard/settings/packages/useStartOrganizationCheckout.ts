import type { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import type { ErrorBox } from '@stamhoofd/components/errors/ErrorBox';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform';

import { ViewStepsManager } from '@stamhoofd/components/steps/ViewStepsManager';
import type { DisplayOptions, NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions';
import { PaymentHandler } from '@stamhoofd/components/views/PaymentHandler';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { BaseOrganization, CheckoutResponse, DetailedPayableBalance, OrganizationCheckout, OrganizationPackagesStatus } from '@stamhoofd/structures';
import { Organization, PaymentStatus } from '@stamhoofd/structures';
import { useLoadPayableBalance } from '../hooks/useLoadPayableBalance';
import { useCheckoutOrganizationCheckout } from './hooks/useCheckoutOrganizationCheckout';
import { useOrganizationPackages } from './hooks/useOrganizationPackages';
import type { PayBalanceMode } from './OrganizationCheckoutViewModel';
import { OrganizationCheckoutViewModel } from './OrganizationCheckoutViewModel';
import { BalanceSelectionStep } from './steps/BalanceSelectionStep';
import { PackageOverviewStep } from './steps/PackageOverviewStep';
import { PaymentCustomerStep } from './steps/PaymentCustomerStep';
import { PaymentSelectionWithMandatesStep } from './steps/PaymentSelectionWithMandatesStep';

export function useStartOrganizationCheckout() {
    const context = useContext();
    const platform = usePlatform();
    const payingOrganization = useRequiredOrganization();
    const { packages: packageStatus, reload } = useOrganizationPackages({ onMounted: false });
    const owner = useRequestOwner();
    const navigationActions = useNavigationActions();
    const checkoutOrganizationCheckout = useCheckoutOrganizationCheckout();
    const loadPayableBalance = useLoadPayableBalance();

    /**
     * Can throw, so please catch errors.
     */
    async function doStartOrganizationCheckout({ checkout, displayOptions, forceNewMandate, sellingOrganizationId, sellingOrganization, payableBalance, payBalanceMode }: {
        checkout: OrganizationCheckout;
        sellingOrganizationId?: string;
        sellingOrganization?: BaseOrganization;
        displayOptions: DisplayOptions;
        forceNewMandate?: boolean;
        payBalanceMode: PayBalanceMode;

        /**
         * Optional, otherwise will get loaded async
         */
        payableBalance?: DetailedPayableBalance;
    } & ({ sellingOrganizationId?: string } | { sellingOrganization: Organization })) {
        if (!sellingOrganization && !sellingOrganizationId) {
            sellingOrganizationId = platform.value.membershipOrganizationId ?? undefined;
        }

        if (sellingOrganization) {
            if (sellingOrganizationId) {
                throw new Error('Invalid usage');
            }
            sellingOrganizationId = sellingOrganization.id;
        }

        if (!sellingOrganizationId) {
            throw new SimpleError({
                code: 'unavailable',
                message: 'Temporarily unavailable due to missing membershipOrganizationId',
                human: $t('%1Ri'),
            });
        }

        let status: OrganizationPackagesStatus | undefined;
        if (!packageStatus.value) {
            status = await reload();

            if (!status) {
                return;
            }
        } else {
            status = packageStatus.value;
        }

        if (!sellingOrganization) {
            const server = context.value.getOptionalAuthenticatedServerForOrganization(sellingOrganizationId);
            const response = await server.request({
                method: 'GET',
                path: '/organization',
                decoder: Organization as Decoder<Organization>,
                owner,
            });
            sellingOrganization = response.data;
        }

        if (!payableBalance) {
            // todo: only load payable balance if we know this will be required
            payableBalance = await loadPayableBalance(sellingOrganization.id);
        }

        const model = new OrganizationCheckoutViewModel({
            checkout,
            packageStatus: status,
            sellingOrganization,
            payingOrganization: payingOrganization.value,
            forceNewMandate,
            payableBalance,
            payBalanceMode,
        });

        // Set urls
        model.checkout.redirectUrl = new URL(window.location.href);
        model.checkout.cancelUrl = new URL(window.location.href);

        // Force https protocol (the app can use capacitor:// instead of https, so we need to swap)
        if (model.checkout.redirectUrl.protocol !== 'https:') {
            // NOTE: setting protocol doesn't work in all situations (weird!)
            model.checkout.redirectUrl = new URL(model.checkout.redirectUrl.toString().replace(model.checkout.redirectUrl.protocol, 'https:'));
        }

        if (model.checkout.cancelUrl.protocol !== 'https:') {
            // NOTE: setting protocol doesn't work in all situations (weird!)
            model.checkout.cancelUrl = new URL(model.checkout.cancelUrl.toString().replace(model.checkout.cancelUrl.protocol, 'https:'));
        }

        // Validate model before starting
        model.validate();

        let steps = [
            new PackageOverviewStep({ model }),
            new PaymentCustomerStep({ model }),
            new BalanceSelectionStep({ model }),
            new PaymentSelectionWithMandatesStep({ model }),
        ];

        if (model.checkout.purchases.empty) {
            // Moves balance selection to the front
            steps = [
                new BalanceSelectionStep({ model }),
                new PackageOverviewStep({ model }),
                new PaymentCustomerStep({ model }),
                new PaymentSelectionWithMandatesStep({ model }),
            ];
        }

        const stepManager = new ViewStepsManager(steps, async (navigate: NavigationActions) => {
            const response = await checkoutOrganizationCheckout(model.sellingOrganization.id, model.checkout);
            await handleCheckoutResponse({
                navigate,
                response,
                sellingOrganization,
                context: context.value,
            });
        }, displayOptions);

        await stepManager.saveHandler(null, navigationActions);
    }

    return async function startOrganizationCheckout(...options: Parameters<typeof doStartOrganizationCheckout>) {
        try {
            await doStartOrganizationCheckout(...options);
        } catch (e) {
            Toast.fromError(e).show();
        }
    };
}

async function handleCheckoutResponse({ response, sellingOrganization, context, navigate }: {
    response: CheckoutResponse;
    sellingOrganization: BaseOrganization;
    context: SessionContext;
    navigate: NavigationActions;
}) {
    const payment = response.payment;
    const server = context.getOptionalAuthenticatedServerForOrganization(sellingOrganization.id);

    if (payment && payment.status !== PaymentStatus.Succeeded) {
        await PaymentHandler.handlePayment({
            server,
            organization: sellingOrganization,
            payment,
            paymentUrl: response.paymentUrl,
            paymentQRCode: response.paymentQRCode,
            navigate,
            transferSettings: sellingOrganization.meta.registrationPaymentConfiguration.transferSettings,
            type: 'registration',
        }, async (payment, navigate: NavigationActions) => {
            await navigate.show({
                components: [
                    AsyncComponent(() => import('@stamhoofd/components/payments/PaymentSuccessView.vue'), {
                        payment,
                    }),
                ],
                replace: 100, // autocorrects to all
                force: true,
            });
        }, () => {
            // Silently ignore for now
            console.log(payment);
        }, () => {
            // todo
        });
        return;
    }

    await navigate.show({
        components: [
            AsyncComponent(() => import('@stamhoofd/components/payments/PaymentSuccessView.vue'), {
                payment,
                fallback: {
                    title: $t('%1cZ'),
                },
            }),
        ],
        replace: 100, // autocorrects to all
        force: true,
    });
}
