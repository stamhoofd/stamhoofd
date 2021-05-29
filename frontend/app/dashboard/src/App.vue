<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, HistoryManager,ModalStackComponent, NavigationController,SplitViewController } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, CenteredMessage, CenteredMessageView, ColorHelper, ForgotPasswordResetView, PromiseView, Toast,ToastBox } from '@stamhoofd/components';
import { Logger } from "@stamhoofd/logger"
import { LoginHelper, NetworkManager, Session, SessionManager } from '@stamhoofd/networking';
import { Invite } from '@stamhoofd/structures';
import { Component, Vue } from "vue-property-decorator";

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
        loginRoot: new ComponentWithProperties(OrganizationSelectionView),
        noPermissionsRoot: asyncComponent(() => import(/* webpackChunkName: "NoPermissionsView", webpackPrefetch: true */ './views/login/NoPermissionsView.vue'), {})
    });

    mounted() {
        HistoryManager.activate();
        SessionManager.restoreLastSession().catch(e => {
            console.error(e)
        })
        //ColorHelper.darkTheme()

        CenteredMessage.addListener(this, async (centeredMessage) => {
            console.log(this.$refs.modalStack);
            if (this.$refs.modalStack === undefined) {
                // Could be a webpack dev server error (HMR) (not fixable) or called too early
                console.error("modalStack ref not found!")
                await this.$nextTick()
            }
            (this.$refs.modalStack as any).present(new ComponentWithProperties(CenteredMessageView, { centeredMessage }).setDisplayStyle("overlay"))
        })

        const path = window.location.pathname;
        const parts = path.substring(1).split("/");
        const queryString = new URL(window.location.href).searchParams;

        if (parts.length == 2 && parts[0] == 'reset-password') {
            const session = new Session(parts[1]);
            const token = queryString.get('token');
            (this.$refs.modalStack as any).present(new ComponentWithProperties(ForgotPasswordResetView, { initialSession: session, token }).setDisplayStyle("popup").setAnimated(false));
        }

        if (parts.length == 1 && parts[0] == 'unsubscribe') {
            const id = queryString.get('id')
            const token = queryString.get('token')

            const toast = new Toast("Bezig met uitschrijven...", "spinner").setHide(null).show()

            try {
                NetworkManager.server.request({
                    method: "POST",
                    path: "/email/manage",
                    body: {
                        id,
                        token,
                        unsubscribedMarketing: true
                    }
                }).then(() => {
                    toast.hide()
                    new Toast("Je bent uitgeschreven!", "success green").setHide(10 * 1000).show()
                }).catch(e => {
                    console.error(e)
                    toast.hide()
                    Toast.fromError(e).show()
                })
            } catch (e) {
                console.error(e)
                toast.hide()
            }
        }

        if (parts.length == 2 && parts[0] == 'verify-email') {
            const queryString = new URL(window.location.href).searchParams;
            const token = queryString.get('token')
            const code = queryString.get('code')
                
            if (token && code) {
                // tood: password reset view
                const session = new Session(parts[1]);

                // tood: password reset view
                const toast = new Toast("E-mailadres valideren...", "spinner").setHide(null).show()
                LoginHelper.verifyEmail(session, code, token).then(() => {
                    toast.hide()
                    new Toast("E-mailadres is gevalideerd", "success green").show()
                }).catch(e => {
                    toast.hide()
                    CenteredMessage.fromError(e).addCloseButton().show()
                })
            }
        }

        if (parts.length == 3 && parts[0] == 'invite') {
            // out of date
            new CenteredMessage("Deze link is niet meer geldig", "De uitnodiging die je hebt gekregen is niet langer geldig. Vraag om een nieuwe uitnodiging te versturen.", "error").addCloseButton().show()
        }

        if (parts.length == 1 && parts[0] == 'invite') {
            const queryString = new URL(window.location.href).searchParams;
            const key = queryString.get('key');
            const secret = queryString.get('secret');

            if (key && secret) {
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
                }).setDisplayStyle("popup").setAnimated(false));
            }
        }
    }
}
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "~@stamhoofd/scss/main";
@import "~@simonbackx/vue-app-navigation/dist/main.css";
</style>
