import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { SessionContext } from '@stamhoofd/networking';
import { PaymentStatus, PlatformFamily, RegisterCheckout, RegisterResponse } from '@stamhoofd/structures';
import { NavigationActions } from '../../types/NavigationActions';
import { PaymentHandler } from '../../views/PaymentHandler';
import { RegistrationSuccessView } from '../checkout';
import { ViewStep, ViewStepsManager } from '../classes/ViewStepsManager';
import { FreeContributionStep } from './steps/FreeContributionStep';
import { PaymentSelectionStep } from './steps/PaymentSelectionStep';

export async function startCheckout({checkout, context}: {checkout: RegisterCheckout, context: SessionContext}, navigate: NavigationActions) {
    checkout.validate({})

    const steps: ViewStep[] = [
        new FreeContributionStep(checkout),
        new PaymentSelectionStep(checkout),
    ]

    const stepManager = new ViewStepsManager(steps, async (navigate: NavigationActions) => {
        await register({checkout, context}, navigate)
    }, {present: 'popup'})


    await stepManager.saveHandler(null, navigate)
}


async function register({checkout, context}: {checkout: RegisterCheckout, context: SessionContext}, navigate: NavigationActions) {
    const organization = checkout.singleOrganization!
    const server = context.getAuthenticatedServerForOrganization(organization.id)

    const idCheckout = checkout.convert()
    idCheckout.redirectUrl = new URL(organization.registerUrl+'/payment')
    idCheckout.cancelUrl = new URL(organization.registerUrl+'/payment?cancel=true')

    const response = await server.request({
        method: "POST",
        path: "/members/register",
        body: idCheckout,
        decoder: RegisterResponse as Decoder<RegisterResponse>,
        shouldRetry: false
    })
    
    const payment = response.data.payment
    const registrations = response.data.registrations

    // Copy data to members
    const passedFamilies = new Set<PlatformFamily>()
    for (const member of checkout.cart.items.map(i => i.member)) {
        if (passedFamilies.has(member.family)) {
            continue
        }
        member.family.updateFromBlob(response.data.members)
        passedFamilies.add(member.family)
    }

    if (payment && payment.status !== PaymentStatus.Succeeded) {
        await PaymentHandler.handlePayment({
            server, 
            organization: checkout.singleOrganization!, 
            payment, 
            paymentUrl: response.data.paymentUrl, 
            navigate,
            transferSettings: checkout.singleOrganization!.meta.registrationPaymentConfiguration.transferSettings,
            type: "registration"
        }, async (_payment, navigate: NavigationActions) => {
            await navigate.show({
                components: [
                    new ComponentWithProperties(RegistrationSuccessView, {
                        registrations,
                        checkout: checkout
                    })
                ], 
                replace: 100, // autocorrects to all
                force: true
            })
        }, () => {
            // Silently ignore for now
            console.log(payment)
        }, () => {
            checkout.clear()
        })
        return;
    }

    checkout.clear()
    await navigate.show({
        components: [
            new ComponentWithProperties(RegistrationSuccessView, {
                registrations,
                checkout: checkout
            })
        ], 
        replace: 100, 
        force: true
    })
}
