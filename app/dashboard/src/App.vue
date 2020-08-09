<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, HistoryManager,ModalStackComponent, SplitViewController, NavigationController } from "@simonbackx/vue-app-navigation";
import { Component, Vue } from "vue-property-decorator";
import { AuthenticatedView, PromiseView } from '@stamhoofd/components';
import DashboardMenu from './views/dashboard/DashboardMenu.vue'
import OrganizationSelectionSteps from './views/login/OrganizationSelectionSteps.vue';
import OrganizationSelectionView from './views/login/OrganizationSelectionView.vue';
import { SessionManager, NetworkManager } from '@stamhoofd/networking';
import { Invite } from '@stamhoofd/structures';
import { Decoder } from '@simonbackx/simple-encoding';
import { Logger } from "@stamhoofd/logger"

function asyncComponent(component: () => Promise<any>, properties = {}) {
    return new ComponentWithProperties(PromiseView, {
        promise: async function() {
            const c = (await component()).default
            return new ComponentWithProperties(c, properties)
        }
    })
}

// kick off the polyfill!
//smoothscroll.polyfill();
@Component({
    components: {
        ModalStackComponent
    },
})
export default class App extends Vue {
    root = new ComponentWithProperties(AuthenticatedView, {
        root: new ComponentWithProperties(SplitViewController, {
            root: asyncComponent(() => import(/* webpackChunkName: "DashboardMenu", webpackPrefetch: true */ './views/dashboard/DashboardMenu.vue'), {})
        }),
        loginRoot: new ComponentWithProperties(OrganizationSelectionSteps, { 
            root: new ComponentWithProperties(OrganizationSelectionView, {}) 
        }),
        noPermissionsRoot: new ComponentWithProperties(OrganizationSelectionSteps, { 
            root: asyncComponent(() => import(/* webpackChunkName: "NoPermissionsView", webpackPrefetch: true */ './views/login/NoPermissionsView.vue'), {})
        }),
    });

    mounted() {
        HistoryManager.activate();

        const path = window.location.pathname;
        const parts = path.substring(1).split("/");

        if (parts.length == 3 && parts[0] == 'invite') {

            const key = parts[2];
            const secret = decodeURIComponent(parts[1]);

            (this.$refs.modalStack as any).present(new ComponentWithProperties(NavigationController, { 
                root: new ComponentWithProperties(PromiseView, {
                    promise: async () => {
                        try {
                            const response = await NetworkManager.server.request({
                                method: "GET",
                                path: "/invite/"+key,
                                decoder: Invite as Decoder<Invite>
                            })

                            if (response.data.validUntil < new Date(new Date().getTime() + 1000 * 10)) {
                                // Invalid or almost invalid
                                const InvalidInviteView = (await import(/* webpackChunkName: "InvalidInviteView" */ './views/invite/InvalidInviteView.vue')).default;
                                return new ComponentWithProperties(InvalidInviteView, {
                                    invite: response.data
                                })
                            }
                            const AcceptInviteView = (await import(/* webpackChunkName: "AcceptInviteView" */ './views/invite/AcceptInviteView.vue')).default;
                            return new ComponentWithProperties(AcceptInviteView, {
                                invite: response.data,
                                secret
                            })
                        } catch (e) {
                            Logger.error(e)
                            // Probably invalid invite
                            const InvalidInviteView = (await import(/* webpackChunkName: "InvalidInviteView" */ './views/invite/InvalidInviteView.vue')).default;
                            return new ComponentWithProperties(InvalidInviteView, {})
                        }
                        
                    }
                })
            }).setDisplayStyle("popup"));
        }

        if (parts.length == 1 && parts[0] == 'aansluiten') {
            // todo: go to create organization page
            /*(this.$refs.modalStack as any).present(new ComponentWithProperties(NavigationController, { 
                root: new ComponentWithProperties(CreateShop, {})
            }));*/
            (this.$refs.modalStack as any).present(new ComponentWithProperties(NavigationController, {
                root: asyncComponent(() => import(/* webpackChunkName: "SignupGeneralView" */ './views/signup/SignupGeneralView.vue'), {})
            }).setDisplayStyle("popup"))
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
