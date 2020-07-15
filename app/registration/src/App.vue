<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, HistoryManager,ModalStackComponent, SplitViewController } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, PromiseView } from '@stamhoofd/components';
import { Component, Vue } from "vue-property-decorator";
import RegistrationSteps from './views/login/RegistrationSteps.vue';
import LoginView from './views/login/LoginView.vue';
import OverviewView from './views/overview/OverviewView.vue';
import { NetworkManager, SessionManager, Session } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { Decoder } from '@simonbackx/simple-encoding';
import InvalidOrganizationView from './views/errors/InvalidOrganizationView.vue';

// kick off the polyfill!
//smoothscroll.polyfill();
@Component({
    components: {
        ModalStackComponent
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
                    root: new ComponentWithProperties(RegistrationSteps, { 
                        root: new ComponentWithProperties(OverviewView, {}),
                    }),
                    loginRoot: new ComponentWithProperties(RegistrationSteps, { 
                        root: new ComponentWithProperties(LoginView, {}) 
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
