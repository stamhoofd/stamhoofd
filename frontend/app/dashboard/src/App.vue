<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, HistoryManager,ModalStackComponent, NavigationController,SplitViewController } from "@simonbackx/vue-app-navigation";
import { AsyncComponent, AuthenticatedView, CenteredMessage, CenteredMessageView, ColorHelper, ForgotPasswordResetView, GlobalEventBus, PromiseView, Toast,ToastBox, ToastButton } from '@stamhoofd/components';
import { Sodium } from '@stamhoofd/crypto';
import { Logger } from "@stamhoofd/logger"
import { Keychain, LoginHelper, NetworkManager, Session, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Invite, Token } from '@stamhoofd/structures';
import { Component, Vue } from "vue-property-decorator";

import OrganizationSelectionView from './views/login/OrganizationSelectionView.vue';

// kick off the polyfill!
//smoothscroll.polyfill();
@Component({
    components: {
        ModalStackComponent,
        ToastBox
    },
})
export default class App extends Vue {
    root = new ComponentWithProperties(PromiseView, {
        promise: async () => {
            await SessionManager.restoreLastSession()

            if (navigator.platform.indexOf("Win32")!=-1 || navigator.platform.indexOf("Win64")!=-1){
                // Load Windows stylesheet
                await import("@stamhoofd/scss/layout/windows-scrollbars.scss");
            }

            return new ComponentWithProperties(AuthenticatedView, {
                root: new ComponentWithProperties(SplitViewController, {
                    root: AsyncComponent(() => import(/* webpackChunkName: "DashboardMenu", webpackPrefetch: true */ './views/dashboard/DashboardMenu.vue'), {})
                }),
                loginRoot: new ComponentWithProperties(OrganizationSelectionView),
                noPermissionsRoot: AsyncComponent(() => import(/* webpackChunkName: "NoPermissionsView" */ './views/login/NoPermissionsView.vue'), {})
            });
        }
    })

    created() {
        if (process.env.NODE_ENV == "development") {
            ComponentWithProperties.debug = true
        }

        try {
            ColorHelper.setColor("#0053ff")
            ColorHelper.setupDarkTheme()
        } catch (e) {
            console.error("Color setup failed")
            console.error(e)
        }
        HistoryManager.activate();
    }

    mounted() {
        SessionManager.addListener(this, (changed) => {
            if (changed == "organization") {
                this.checkKey().catch(console.error)
            }
        })
        CenteredMessage.addListener(this, async (centeredMessage) => {
            if (this.$refs.modalStack === undefined) {
                // Could be a webpack dev server error (HMR) (not fixable) or called too early
                await this.$nextTick()
            }
            (this.$refs.modalStack as any).present(new ComponentWithProperties(CenteredMessageView, { centeredMessage }).setDisplayStyle("overlay"))
        })

        const parts = UrlHelper.shared.getParts();
        const queryString = UrlHelper.shared.getSearchParams()

        if (parts.length == 2 && parts[0] == 'reset-password') {
            UrlHelper.shared.clear()
            const token = queryString.get('token');
            (this.$refs.modalStack as any).present(new ComponentWithProperties(PromiseView, {
                promise: async () => {
                    const session = new Session(parts[1]);
                    await session.loadFromStorage()
                    return new ComponentWithProperties(ForgotPasswordResetView, { initialSession: session, token })
                }
            }).setDisplayStyle("popup").setAnimated(false));
        }

        if (parts.length >= 1 && parts[0] == 'login' && queryString.get("refresh_token") && queryString.get("organization_id") && queryString.get("auth_encryption_key")) {
            UrlHelper.shared.clear()
            const organizationId = queryString.get("organization_id")!
            const refreshToken = queryString.get("refresh_token")!
            const authEncryptionKey = queryString.get("auth_encryption_key")!
            
            this.loginWithToken(organizationId, refreshToken, authEncryptionKey).catch(console.error)
        }

        if (parts.length == 1 && parts[0] == 'unsubscribe') {
            UrlHelper.shared.clear()
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
            UrlHelper.shared.clear()
            const token = queryString.get('token')
            const code = queryString.get('code')
                
            if (token && code) {
                const session = new Session(parts[1]);
                const toast = new Toast("E-mailadres valideren...", "spinner").setHide(null).show()
                session.loadFromStorage()
                .then(() => LoginHelper.verifyEmail(session, code, token))
                .then(() => {
                    toast.hide()
                    new Toast("E-mailadres is gevalideerd", "success green").show()
                }).catch(e => {
                    toast.hide()
                    CenteredMessage.fromError(e).addCloseButton().show()
                })
            }
        }

        if (parts.length == 3 && parts[0] == 'invite') {
            UrlHelper.shared.clear()
            // out of date
            new CenteredMessage("Deze link is niet meer geldig", "De uitnodiging die je hebt gekregen is niet langer geldig. Vraag om een nieuwe uitnodiging te versturen.", "error").addCloseButton().show()
        }

        if (parts.length == 1 && parts[0] == 'invite') {
            UrlHelper.shared.clear()
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
                                let session = await SessionManager.getSessionForOrganization(response.data.organization.id)
                                if (!session) {
                                    session = new Session(response.data.organization.id)
                                    await session.loadFromStorage()
                                }
                                const AcceptInviteView = (await import(/* webpackChunkName: "AcceptInviteView" */ './views/invite/AcceptInviteView.vue')).default;
                                return new ComponentWithProperties(AcceptInviteView, {
                                    session,
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

    /**
     * Login at a given organization, with the given refresh token
     */
    async loginWithToken(organizationId: string, refreshToken: string, authEncryptionKey: string) {
        // todo: add security toggle in system configuration to disable this feature
        if (!await CenteredMessage.confirm("Ben je zeker dat je wilt inloggen via deze link?", "Inloggen", "Klik op annuleren als je niet weet waar dit over gaat.")) {
            return
        }
        try {
            let session = await SessionManager.getSessionForOrganization(organizationId)
            if (!session) {
                session = new Session(organizationId)
                await session.loadFromStorage()
            }

            if (session.user) {
                // Clear user
                session.user = null;
            }

            // Clear all known keys
            session.clearKeys()

            session.setToken(new Token({
                accessToken: "",
                refreshToken,
                accessTokenValidUntil: new Date(0)
            }))
            await session.setEncryptionKey(authEncryptionKey)
            await SessionManager.setCurrentSession(session, false)           
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
        }
    }

    async checkKey() {
        console.log("Checking key...")

        // Check if public and private key matches
        if (!SessionManager.currentSession) {
            return
        }

        const session = SessionManager.currentSession

        const user = session.user

        if (!user || !user.permissions) {
            return
        }
        
        const privateKey = session.getUserPrivateKey()

        if (!privateKey) {
            return
        }
        const publicKey = user.publicKey

        if (!await Sodium.isMatchingEncryptionPublicPrivate(publicKey, privateKey)) {

            // Gather all keychain items, and check which ones are still valid
            // Oops! Error with public private key
            await LoginHelper.fixPublicKey(session)
            new Toast("We hebben jouw persoonlijke encryptiesleutel gecorrigeerd. Er was iets fout gegaan toen je je wachtwoord had gewijzigd.", "success green").setHide(15*1000).show()
            GlobalEventBus.sendEvent("encryption", null).catch(console.error)
        }

        try {
            const keychainItem = Keychain.getItem(session.organization!.publicKey)
            if (!keychainItem) {
                throw new Error("Missing organization keychain")
            }

            await session.decryptKeychainItem(keychainItem)

            console.log("We have access to the current organization private key")
        } catch (e) {
            console.error(e)

            // Show warnign instead
            new Toast("Je hebt geen toegang tot de huidige encryptiesleutel van deze vereniging. Vraag een hoofdbeheerder om jou terug toegang te geven.", "key-lost yellow").setHide(15*1000).setButton(new ToastButton("Meer info", () => {
                (this.$refs.modalStack as any).present(
                    AsyncComponent(() => import(/* webpackChunkName: "NoKeyView" */ './views/dashboard/NoKeyView.vue')).setDisplayStyle("popup")
                )
            })).show()
        }
    }
}
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "~@stamhoofd/scss/main";
@import "~@stamhoofd/scss/base/dark-modus";
@import "~@simonbackx/vue-app-navigation/dist/main.css";

html {
    -webkit-touch-callout:none;
    //user-select: none;
    -webkit-tap-highlight-color: rgba(0,0,0,0);
    -webkit-tap-highlight-color: transparent;
}
</style>
