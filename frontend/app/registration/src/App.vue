<template>
    <div id="app">
        <PromiseView :promise="promise" />
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, HistoryManager,ModalStackComponent, NavigationController } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, CenteredMessage, ColorHelper, PromiseView, ToastBox } from '@stamhoofd/components';
import { NetworkManager, Session,SessionManager } from '@stamhoofd/networking';
import { EncryptedPaymentDetailed, Organization, Payment, PaymentStatus } from '@stamhoofd/structures';
import { Component, Vue } from "vue-property-decorator";

import { MemberManager } from './classes/MemberManager';
import InvalidOrganizationView from './views/errors/InvalidOrganizationView.vue';
import HomeView from './views/login/HomeView.vue';
import RegistrationSteps from './views/login/RegistrationSteps.vue';
import TabBarController, { TabBarItem } from './views/overview/TabBarController.vue';

async function getDefaultView() {
    //if (MemberManager.members!.find(m => m.activeRegistrations.length > 0)) {
    //    return (await import(/* webpackChunkName: "RegistrationOverview" */ "./views/overview/OverviewView.vue")).default
    //}
    return (await import(/* webpackChunkName: "RegistrationOverview" */ "./views/overview/OverviewView.vue")).default;
}

async function getAccountView() {
    return (await import(/* webpackChunkName: "AccountSettingsView" */ "./views/overview/AccountSettingsView.vue")).default;
}


@Component({
    components: {
        ToastBox,
        PromiseView
    },
})
export default class App extends Vue {
    promise = async () => {
        console.log("Fetching organization from domain...")

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
            console.log("Organization fetched!")

            if (!response.data.meta.modules.useMembers) {
                throw new Error("Member module disabled")
            }

            // Set organization and session
            const session = new Session(response.data.id)
            session.setOrganization(response.data)                

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
                                root: new ComponentWithProperties(NavigationController, { 
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
                            root: new ComponentWithProperties(TabBarController, { 
                                items: [
                                    new TabBarItem(
                                        "Inschrijven",
                                        "edit",
                                        new ComponentWithProperties(NavigationController, { 
                                            root: new ComponentWithProperties(await getDefaultView(), {}),
                                        })
                                    ),
                                    new TabBarItem(
                                        "Account",
                                        "user",
                                        new ComponentWithProperties(NavigationController, { 
                                            root: new ComponentWithProperties(await getAccountView(), {}),
                                        })
                                    ),
                                    new TabBarItem(
                                        "Mandje",
                                        "basket",
                                        new ComponentWithProperties(NavigationController, { 
                                            root: new ComponentWithProperties(await getDefaultView(), {}),
                                        })
                                    )
                                ]
                            })
                        })
                    }
                }),
                loginRoot: new ComponentWithProperties(ModalStackComponent, {
                    root: new ComponentWithProperties(HomeView, {}) 
                })
            });
        } catch (e) {
            console.error(e)
            return new ComponentWithProperties(InvalidOrganizationView, {})
        }
    }

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
