<template>
    <div id="app">
        <!--<ModalStackComponent id="app" ref="modalStack" :root="root" />-->
        <ComponentWithPropertiesInstance :component="root"/>
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, HistoryManager,ModalStackComponent, SplitViewController, ComponentWithPropertiesInstance, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, CenteredMessage, CenteredMessageView, ColorHelper, PromiseView, ToastBox } from '@stamhoofd/components';
import { Component, Vue } from "vue-property-decorator";
import RegistrationSteps from './views/login/RegistrationSteps.vue';
import LoginView from './views/login/LoginView.vue';
import { NetworkManager, SessionManager, Session } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { Decoder } from '@simonbackx/simple-encoding';
import InvalidOrganizationView from './views/errors/InvalidOrganizationView.vue';
import { MemberManager } from './classes/MemberManager';

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
                                const PaymentPendingView = (await import(/* webpackChunkName: "RegistrationOverview" */ "./views/overview/PaymentPendingView.vue")).default
                                return new ComponentWithProperties(ModalStackComponent, {
                                    root: new ComponentWithProperties(RegistrationSteps, { 
                                        root: new ComponentWithProperties(PaymentPendingView, {}),
                                    })
                                })
                            }

                            if (MemberManager.members!.find(m => m.activeRegistrations.length > 0)) {
                                const OverviewView = (await import(/* webpackChunkName: "RegistrationOverview" */ "./views/overview/OverviewView.vue")).default
                                return new ComponentWithProperties(ModalStackComponent, {
                                    root: new ComponentWithProperties(RegistrationSteps, { 
                                        root: new ComponentWithProperties(OverviewView, {}),
                                    })
                                })
                            }
                            const RegistrationOverviewView = (await import(/* webpackChunkName: "RegistrationOverview" */ "./views/overview/RegistrationOverviewView.vue")).default;
                            return new ComponentWithProperties(ModalStackComponent, {
                                root: new ComponentWithProperties(RegistrationSteps, { 
                                    root: new ComponentWithProperties(RegistrationOverviewView, {}),
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
