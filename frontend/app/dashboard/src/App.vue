<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, HistoryManager,ModalStackComponent, NavigationController,SplitViewController } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, CenteredMessage, CenteredMessageView, ForgotPasswordResetView, PromiseView, Toast,ToastBox } from '@stamhoofd/components';
import { Logger } from "@stamhoofd/logger"
import { NetworkManager, Session } from '@stamhoofd/networking';
import { Invite } from '@stamhoofd/structures';
import { Component, Vue } from "vue-property-decorator";

import OrganizationSelectionSteps from './views/login/OrganizationSelectionSteps.vue';
import OrganizationSelectionView from './views/login/OrganizationSelectionView.vue';

export function asyncComponent(component: () => Promise<any>, properties = {}) {
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
        ModalStackComponent,
        ToastBox
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

        CenteredMessage.addListener(this, (centeredMessage) => {
            console.log(this.$refs.modalStack);
            (this.$refs.modalStack as any).present(new ComponentWithProperties(CenteredMessageView, { centeredMessage }).setDisplayStyle("overlay"))
        })

        const path = window.location.pathname;
        const parts = path.substring(1).split("/");

        if (parts.length == 2 && parts[0] == 'reset-password') {
            // tood: password reset view
            const session = new Session(parts[1]);
            (this.$refs.modalStack as any).present(new ComponentWithProperties(ForgotPasswordResetView, { initialSession: session }).setDisplayStyle("popup"));
        }

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
    }
}
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "~@stamhoofd/scss/main";
@import "~@simonbackx/vue-app-navigation/dist/main.css";
</style>
