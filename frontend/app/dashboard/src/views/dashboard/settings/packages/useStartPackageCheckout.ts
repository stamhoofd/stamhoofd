import type { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import type { ErrorBox } from '@stamhoofd/components/errors/ErrorBox';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform';
import { ViewStepsManager } from '@stamhoofd/components/steps/ViewStepsManager';
import { useNavigationActions   } from '@stamhoofd/components/types/NavigationActions';
import type {DisplayOptions, NavigationActions} from '@stamhoofd/components/types/NavigationActions';
import type { SessionContext} from '@stamhoofd/networking';
import { useRequestOwner } from '@stamhoofd/networking';
import type { CheckoutResponse, OrganizationPackagesStatus, PackageCheckout } from '@stamhoofd/structures';
import { Organization, PaymentStatus } from '@stamhoofd/structures';
import { useOrganizationPackages } from './hooks/useOrganizationPackages';
import { PackageCheckoutViewModel } from './PackageCheckoutViewModel';
import { PackageOverviewStep } from './steps/PackageOverviewStep';
import { PaymentCustomerStep } from './steps/PaymentCustomerStep';
import { PaymentSelectionWithMandatesStep } from './steps/PaymentSelectionWithMandatesStep';
import { useActivatePackages } from './hooks/useActivatePackages';
import { PaymentHandler } from '@stamhoofd/components/views/PaymentHandler';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import PaymentSuccessView from '@stamhoofd/components/payments/PaymentSuccessView.vue'
import { Toast } from '@stamhoofd/components';

export function useStartPackageCheckout({errors}: {errors: { errorBox: ErrorBox | null }}) {
    const context = useContext();
    const platform = usePlatform();
    const { packages: packageStatus, reload } = useOrganizationPackages({ errors, onMounted: true });
    const owner = useRequestOwner()
    const navigationActions = useNavigationActions();
    const activatePackages = useActivatePackages()

    /**
     * Can throw, so please catch errors.
     */
    async function doStartPackageCheckout({ checkout, displayOptions }: { 
        checkout: PackageCheckout; 
        displayOptions: DisplayOptions 
    }) {
        if (!platform.value.membershipOrganizationId) {
            throw new SimpleError({
                code: 'unavailable',
                message: 'Temporarily unavailable due to missing membershipOrganizationId',
                human: $t('Afrekenen is tijdelijk onbeschikbaar, herlaad te pagina of probeer later opnieuw!')
            })
        }

        let status: OrganizationPackagesStatus | undefined
        if (!packageStatus.value) {
            status = await reload();

            if (!status) {
                return;
            }
        } else {
            status = packageStatus.value
        }
        
        const server = context.value.getOptionalAuthenticatedServerForOrganization(platform.value.membershipOrganizationId);
        const response = await server.request({
            method: 'GET',
            path: '/organization',
            decoder: Organization as Decoder<Organization>,
            owner,
        });
        const sellingOrganization = response.data;

        const model = new PackageCheckoutViewModel({
            checkout,
            packageStatus: status,
            sellingOrganization
        })


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
        model.validate()

        const steps = [
            new PackageOverviewStep({ model }),
            new PaymentCustomerStep({ checkout, invoicesEnabled: true }),
            new PaymentSelectionWithMandatesStep({ model }),
        ];

        const stepManager = new ViewStepsManager(steps, async (navigate: NavigationActions) => {
            const response = await activatePackages(model.checkout);
            await handleCheckoutResponse({
                navigate,
                response,
                sellingOrganization,
                context: context.value
            })
        }, displayOptions);

        await stepManager.saveHandler(null, navigationActions);
    }

    return async function startPackageCheckout(...options: Parameters<typeof doStartPackageCheckout>) {
        try {
            await doStartPackageCheckout(...options)
        } catch (e) {
            Toast.fromError(e).show()
        }
    }
}

async function handleCheckoutResponse({response, sellingOrganization, context, navigate}: {
    response: CheckoutResponse,
    sellingOrganization: Organization,
    context: SessionContext,
    navigate: NavigationActions
}) {
    const payment = response.payment;

    console.log('handleCheckoutResponse', payment)

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
                    new ComponentWithProperties(PaymentSuccessView, {
                        payment
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

    console.log('going!')

    await navigate.show({
        components: [
            new ComponentWithProperties(PaymentSuccessView, {
                payment
            }),
        ],
        replace: 100, // autocorrects to all
        force: true,
    });
}
