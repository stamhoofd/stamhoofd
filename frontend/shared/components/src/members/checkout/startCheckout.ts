import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { SessionContext } from '@stamhoofd/networking';
import { PaymentStatus, PlatformFamily, PlatformMember, RegisterCheckout, RegisterResponse } from '@stamhoofd/structures';
import { DisplayOptions, NavigationActions } from '../../types/NavigationActions';
import { PaymentHandler } from '../../views/PaymentHandler';
import { RegistrationSuccessView } from '../checkout';
import { ViewStep, ViewStepsManager } from '../classes/ViewStepsManager';
import { FreeContributionStep } from './steps/FreeContributionStep';
import { PaymentSelectionStep } from './steps/PaymentSelectionStep';
import { GlobalEventBus } from '../../EventBus';

export async function startCheckout({checkout, context, displayOptions, admin, members}: {checkout: RegisterCheckout, context: SessionContext, displayOptions: DisplayOptions, admin?: boolean, members?: PlatformMember[]}, navigate: NavigationActions) {
    checkout.validate({})

    const steps: ViewStep[] = [
        new FreeContributionStep(checkout),
        new PaymentSelectionStep(checkout),
    ]

    const stepManager = new ViewStepsManager(steps, async (navigate: NavigationActions) => {
        await register({checkout, context, admin, members}, navigate)
    }, displayOptions)

    await stepManager.saveHandler(null, navigate)
}


async function register({checkout, context, admin, members}: {checkout: RegisterCheckout, context: SessionContext, admin?: boolean, members?: PlatformMember[]}, navigate: NavigationActions) {
    const organization = checkout.singleOrganization!
    const server = context.getAuthenticatedServerForOrganization(organization.id)

    const idCheckout = checkout.convert()

    if (!admin) {
        idCheckout.redirectUrl = new URL(organization.registerUrl)
        idCheckout.cancelUrl = new URL(organization.registerUrl)    
    } else {
        idCheckout.redirectUrl = new URL(window.location.href)
        idCheckout.cancelUrl = new URL(window.location.href)
    }

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
    for (const member of [...(members ?? []), ...checkout.cart.items.map(i => i.member)]) {
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
            if (checkout.cart.items.length > 0) {
                GlobalEventBus.sendEvent('members-added', []).catch(console.error)
            } else if (checkout.cart.deleteRegistrations.length > 0) {
                GlobalEventBus.sendEvent('members-deleted', []).catch(console.error)
            }

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
    
    if (checkout.cart.items.length > 0) {
        GlobalEventBus.sendEvent('members-added', []).catch(console.error)
    } else if (checkout.cart.deleteRegistrations.length > 0) {
        GlobalEventBus.sendEvent('members-deleted', []).catch(console.error)
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
