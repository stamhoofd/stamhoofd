<template>
    <!--<ModalStackComponent id="app" ref="modalStack" :root="root" />-->
    <ComponentWithPropertiesInstance id="app" :component="root"/>
</template>

<script lang="ts">
import { ComponentWithProperties, HistoryManager,ModalStackComponent, SplitViewController, ComponentWithPropertiesInstance } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, PromiseView } from '@stamhoofd/components';
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
        ComponentWithPropertiesInstance
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
                SessionManager.setCurrentSession(session)

                return new ComponentWithProperties(AuthenticatedView, {
                    root: new ComponentWithProperties(PromiseView, {
                        promise: async () => {
                            await MemberManager.loadMembers();

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

        const path = window.location.pathname;
        const parts = path.substring(1).split("/");

        if (parts.length == 1 && parts[0] == 'create-organization') {
            // todo: go to create organization page
            /*(this.$refs.modalStack as any).present(new ComponentWithProperties(NavigationController, { 
                root: new ComponentWithProperties(CreateShop, {})
            }));*/
        }

        if (parts.length == 1 && parts[0] == 'reset-password') {
            // tood: password reset view
            /*(this.$refs.modalStack as any).present(new ComponentWithProperties(NavigationController, { 
                root: new ComponentWithProperties(ForgotPasswordResetView, {})
            }));*/
        }
    }
    
}
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "~@stamhoofd/scss/main";
@import "~@simonbackx/vue-app-navigation/dist/main.css";
</style>
