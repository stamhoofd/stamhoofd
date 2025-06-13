import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { SessionContext } from '@stamhoofd/networking';
import { PaymentStatus, PlatformFamily, PlatformMember, RegisterCheckout, RegisterResponse } from '@stamhoofd/structures';
import { GlobalEventBus } from '../../EventBus';
import { DisplayOptions, NavigationActions } from '../../types/NavigationActions';
import { PaymentHandler } from '../../views/PaymentHandler';
import { RegistrationSuccessView } from '../checkout';
import { ViewStep, ViewStepsManager } from '../classes/ViewStepsManager';
import { updateContextFromMembersBlob } from '../';
import { FreeContributionStep } from './steps/FreeContributionStep';
import { PaymentCustomerStep } from './steps/PaymentCustomerStep';
import { PaymentSelectionStep } from './steps/PaymentSelectionStep';

export async function startCheckout({ checkout, context, displayOptions, admin, members }: { checkout: RegisterCheckout; context: SessionContext; displayOptions: DisplayOptions; admin?: boolean; members?: PlatformMember[] }, navigate: NavigationActions) {
    checkout.validate({});

    const steps: ViewStep[] = [
        new FreeContributionStep(checkout),
        new PaymentCustomerStep(checkout),
        new PaymentSelectionStep(checkout),
    ];

    const stepManager = new ViewStepsManager(steps, async (navigate: NavigationActions) => {
        await register({ checkout, context, admin, members }, navigate);
    }, displayOptions);

    await stepManager.saveHandler(null, navigate);
}

async function register({ checkout, context, admin, members }: { checkout: RegisterCheckout; context: SessionContext; admin?: boolean; members?: PlatformMember[] }, navigate: NavigationActions) {
    const organization = checkout.singleOrganization!;
    const server = context.getAuthenticatedServerForOrganization(organization.id);

    const idCheckout = checkout.convert();

    if (!admin) {
        idCheckout.redirectUrl = new URL(organization.registerUrl);
        idCheckout.cancelUrl = new URL(organization.registerUrl);
    }
    else {
        idCheckout.redirectUrl = new URL(window.location.href);
        idCheckout.cancelUrl = new URL(window.location.href);
    }

    // Force https protocol (the app can use capacitor:// instead of https, so we need to swap)
    idCheckout.redirectUrl.protocol = 'https:';
    idCheckout.cancelUrl.protocol = 'https:';

    const response = await server.request({
        method: 'POST',
        path: '/members/register',
        body: idCheckout,
        decoder: RegisterResponse as Decoder<RegisterResponse>,
        shouldRetry: false,
    });

    const payment = response.data.payment;
    const registrations = response.data.registrations;

    // Copy data to members
    PlatformFamily.updateFromBlob([...(members ?? []), ...checkout.cart.items.map(i => i.member)], response.data.members);
    updateContextFromMembersBlob(context, response.data.members);

    const clearAndEmit = () => {
        if (checkout.cart.items.length > 0) {
            GlobalEventBus.sendEvent('members-added', []).catch(console.error);
        }
        else if (checkout.cart.deleteRegistrations.length > 0) {
            GlobalEventBus.sendEvent('members-deleted', []).catch(console.error);
        }

        checkout.clear();
    };

    if (payment && payment.status !== PaymentStatus.Succeeded) {
        await PaymentHandler.handlePayment({
            server,
            organization: checkout.singleOrganization!,
            payment,
            paymentUrl: response.data.paymentUrl,
            navigate,
            transferSettings: checkout.singleOrganization!.meta.registrationPaymentConfiguration.transferSettings,
            type: 'registration',
        }, async (_payment, navigate: NavigationActions) => {
            clearAndEmit();

            await navigate.show({
                components: [
                    new ComponentWithProperties(RegistrationSuccessView, {
                        registrations,
                        checkout: checkout,
                    }),
                ],
                replace: 100, // autocorrects to all
                force: true,
            });
        }, () => {
            // Silently ignore for now
            console.log(payment);
        }, () => {
            clearAndEmit();
        });
        return;
    }
    GlobalEventBus.sendEvent('paymentPatch', payment).catch(console.error);
    clearAndEmit();
    await navigate.show({
        components: [
            new ComponentWithProperties(RegistrationSuccessView, {
                registrations,
                checkout: checkout,
            }),
        ],
        replace: 100,
        force: true,
    });
}
