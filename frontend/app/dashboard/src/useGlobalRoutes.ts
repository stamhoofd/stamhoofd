import { ComponentWithProperties, NavigationController, NavigationMixin, onCheckRoutes, UrlHelper, useModalStackComponent } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ForgotPasswordResetView, PaymentPendingView, RegistrationSuccessView, useContext } from "@stamhoofd/components";
import { PaymentGeneral, PaymentStatus } from "@stamhoofd/structures";

let didCheckGlobalRoutes = false;
export function useGlobalRoutes() {
    const modalStackComponent = useModalStackComponent();
    const context = useContext();

    const present = (component: ComponentWithProperties) => {
        const currentPath = UrlHelper.shared.getPath({ removeLocale: true })
        modalStackComponent.value.present({
            adjustHistory: true,
            animated: false,
            force: true,
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: component
                }, {
                    provide: {
                        reactive_navigation_url: currentPath 
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    onCheckRoutes(async () => {
        if (didCheckGlobalRoutes) {
            // When switching root components, the routes are rechecked, so we need to prevent rechecks on these routes
            return
        }
        didCheckGlobalRoutes = true
        const currentPath = UrlHelper.shared.getPath({ removeLocale: true })
        const parts = UrlHelper.shared.getParts();
        const queryString = UrlHelper.shared.getSearchParams()
        console.log('Checking global routes', parts, queryString, currentPath)
    
        if (queryString.get('paymentId')) {
            const paymentId = queryString.get('paymentId')
            const cancel = queryString.get("cancel") === "true"

            if (paymentId) {
                present(new ComponentWithProperties(PaymentPendingView, { 
                    server: context.value.optionalAuthenticatedServer, 
                    paymentId,
                    cancel,
                    errorHandler: async function(this: InstanceType<typeof NavigationMixin>, error: unknown) {
                        await this.dismiss({force: true})
                        CenteredMessage.fromError(error).addCloseButton().show()
                    },
                    finishedHandler: async function(this: InstanceType<typeof NavigationMixin>, payment: PaymentGeneral | null) {
                        if (payment && payment.status == PaymentStatus.Succeeded) {
                            // TODO: fetch appropriate data for this payment!
                            
                            if (payment.memberNames.length) {
                                await this.show({
                                    components: [
                                        new ComponentWithProperties(RegistrationSuccessView, {
                                            registrations: [], // todo: fetch registrations
                                            payment
                                        })
                                    ], 
                                    replace: 100, // autocorrects to all
                                    force: true
                                })
                            } else {
                                await this.dismiss({force: true})
                                new CenteredMessage("Betaling voltooid", "De betaling werd voltooid.").addCloseButton().show()
                            }
                        } else {
                            await this.dismiss({force: true})
                            new CenteredMessage("Betaling mislukt", "De betaling werd niet voltooid of de bank heeft de betaling geweigerd. Probeer het opnieuw.").addCloseButton().show()
                        }
                    } 
                }))
            }
        }

        if (parts.length > 0 && parts[0] == 'reset-password') {    
            // Clear initial url before pushing to history, because else, when closing the popup, we'll get the original url...

            const token = queryString.get('token');
            const organizationId = parts[1] ? parts[1] : null;

            if ((organizationId && context.value.organization?.id == organizationId)) {
                console.log('Ignored reset password route because organization is not the same')
                return
            }

            present(new ComponentWithProperties(ForgotPasswordResetView, { token }))
        }
    })
}
