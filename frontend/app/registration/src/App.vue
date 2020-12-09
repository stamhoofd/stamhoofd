<template>
    <div id="app">
        <!--<ModalStackComponent id="app" ref="modalStack" :root="root" />-->
        <ComponentWithPropertiesInstance :component="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, ComponentWithPropertiesInstance, HistoryManager,ModalStackComponent, NavigationController, NavigationMixin,SplitViewController } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, CenteredMessage, CenteredMessageView, ColorHelper, PromiseView, ToastBox } from '@stamhoofd/components';
import { NetworkManager, Session,SessionManager } from '@stamhoofd/networking';
import { EncryptedPaymentDetailed, Organization, Payment, PaymentStatus } from '@stamhoofd/structures';
import { Component, Vue } from "vue-property-decorator";

import { MemberManager } from './classes/MemberManager';
import InvalidOrganizationView from './views/errors/InvalidOrganizationView.vue';
import LoginView from './views/login/LoginView.vue';
import RegistrationSteps from './views/login/RegistrationSteps.vue';

async function getDefaultView() {
    if (MemberManager.members!.find(m => m.activeRegistrations.length > 0)) {
        return (await import(/* webpackChunkName: "RegistrationOverview" */ "./views/overview/OverviewView.vue")).default
    }
    return (await import(/* webpackChunkName: "RegistrationOverview" */ "./views/overview/RegistrationOverviewView.vue")).default;
}

@Component({
    components: {
        ComponentWithPropertiesInstance,
        ToastBox
    },
})
export default class App extends Vue {
    root = new ComponentWithProperties(PromiseView, {
        promise: async () => {
            // get organization
            try {
                const response = await NetworkManager.server.request({
                    method: "GET",
                    path: "/organization-from-domain",
                    query: {
                        domain: window.location.hostname
                    },
                    decoder: Organization as Decoder<Organization>
                })

                if (!response.data.meta.modules.useMembers) {
                    throw new Error("Member module disabled")
                }

                // Set organization and session
                const session = new Session(response.data.id)
                session.setOrganization(response.data)

                document.title = response.data.name+" - Inschrijven"

                // Set color
                if (response.data.meta.color) {
                    ColorHelper.setColor(response.data.meta.color)
                }

                await SessionManager.setCurrentSession(session)

                

                return new ComponentWithProperties(AuthenticatedView, {
                    root: new ComponentWithProperties(PromiseView, {
                        promise: async () => {
                            await MemberManager.loadMembers();

                            const path = window.location.pathname;
                            const parts = path.substring(1).split("/");

                            if (parts.length == 1 && parts[0] == 'payment') {
                                // tood: password reset view
                                const PaymentPendingView = (await import(/* webpackChunkName: "PaymentPendingView" */ "@stamhoofd/components/src/views/PaymentPendingView.vue")).default
                                return new ComponentWithProperties(ModalStackComponent, {
                                    root: new ComponentWithProperties(RegistrationSteps, { 
                                        root: new ComponentWithProperties(PaymentPendingView, {
                                            server: SessionManager.currentSession!.authenticatedServer,
                                            paymentId: new URL(window.location.href).searchParams.get("id"),
                                            finishedHandler: async function(this: any, payment: Payment | null) {
                                                if (payment && payment.status == PaymentStatus.Succeeded) {
                                                    const RegistrationSuccessView = (await import(/* webpackChunkName: "PaymentPendingView" */ "./views/overview/RegistrationSuccessView.vue")).default
                                                    const response = await session.authenticatedServer.request({
                                                        method: "GET",
                                                        path: "/payments/"+payment.id+"/registrations",
                                                        decoder: EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>
                                                    })
                                                    const registrations = await MemberManager.getRegistrationsWithMember(response.data.registrations)
                                                    this.show(new ComponentWithProperties(RegistrationSuccessView, {
                                                        registrations
                                                    }))
                                                } else {
                                                    this.navigationController.push(new ComponentWithProperties(await getDefaultView(), {}), true, 1, true)
                                                    new CenteredMessage("Betaling mislukt", "De betaling werd niet voltooid of de bank heeft de betaling geweigerd. Probeer het opnieuw.", "error").addCloseButton().show()
                                                }
                                            }
                                        }),
                                    })
                                })
                            }

                            return new ComponentWithProperties(ModalStackComponent, {
                                root: new ComponentWithProperties(RegistrationSteps, { 
                                    root: new ComponentWithProperties(await getDefaultView(), {}),
                                })
                            })
                        }
                    }),
                    loginRoot: new ComponentWithProperties(ModalStackComponent, {
                        root: new ComponentWithProperties(RegistrationSteps, { 
                            root: new ComponentWithProperties(LoginView, {}) 
                        })
                    })
                });
            } catch (e) {
                return new ComponentWithProperties(InvalidOrganizationView, {})
            }
        }
    })

    mounted() {
        HistoryManager.activate();
    }
    
}
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "~@stamhoofd/scss/main";
@import "~@simonbackx/vue-app-navigation/dist/main.css";
</style>
