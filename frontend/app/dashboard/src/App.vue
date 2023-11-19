<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, HistoryManager, ModalStackComponent, PushOptions, SplitViewController } from "@simonbackx/vue-app-navigation";
import { AsyncComponent, AuthenticatedView, CenteredMessage, CenteredMessageView, ForgotPasswordResetView, ModalStackEventBus, PromiseView, Toast, ToastBox } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { AppManager, LoginHelper, NetworkManager, Session, SessionManager, Storage, UrlHelper } from '@stamhoofd/networking';
import { Country, EmailAddressSettings, Token } from '@stamhoofd/structures';
import { Component, Vue } from "vue-property-decorator";

import OrganizationSelectionView from './views/login/OrganizationSelectionView.vue';

@Component({
    components: {
        ModalStackComponent,
        ToastBox
    },
})
export default class App extends Vue {
    root = new ComponentWithProperties(PromiseView, {
        promise: async () => {
            try {
                await SessionManager.restoreLastSession()

                // Default language for dashboard is nl-BE, but if we are signed in, always force set the country to the organization country
                await I18nController.loadDefault("dashboard", Country.Belgium, "nl", SessionManager.currentSession?.organization?.address?.country)


                if (navigator.platform.indexOf("Win32")!=-1 || navigator.platform.indexOf("Win64")!=-1){
                    // Load Windows stylesheet
                    try {
                        await import("@stamhoofd/scss/layout/windows-scrollbars.scss");
                    } catch (e) {
                        console.error("Failed to load Windows scrollbars")
                        console.error(e)
                    }
                }

                this.checkGlobalRoutes()

                return new ComponentWithProperties(AuthenticatedView, {
                    root: new ComponentWithProperties(SplitViewController, {
                        root: AsyncComponent(() => import(/* webpackChunkName: "DashboardMenu", webpackPrefetch: true */ './views/dashboard/DashboardMenu.vue'), {})
                    }),
                    loginRoot: new ComponentWithProperties(OrganizationSelectionView),
                    noPermissionsRoot: AsyncComponent(() => import(/* webpackChunkName: "NoPermissionsView" */ './views/login/NoPermissionsView.vue'), {})
                });
            } catch (e) {
                console.error(e)
                Toast.fromError(e).setHide(null).show()
                throw e
            }
        }
    })

    created() {
        /*if (STAMHOOFD.environment == "development") {
            console.log('Debug mode activated', ComponentWithProperties)
            ComponentWithProperties.debug = true;
            (window as any).ComponentWithProperties = ComponentWithProperties;
            (window as any).HistoryManager = HistoryManager
        }*/

        try {
            // ColorHelper.setColor("#8B17FF")
            // ColorHelper.setupDarkTheme()
        } catch (e) {
            console.error("Color setup failed")
            console.error(e)
        }
        HistoryManager.activate();
    }

    checkGlobalRoutes() {
        // Always set initial route
        UrlHelper.setUrl("/")

        const currentPath = UrlHelper.shared.getPath({ removeLocale: true })
        const parts = UrlHelper.shared.getParts();
        const queryString = UrlHelper.shared.getSearchParams()

        if (parts.length == 2 && parts[0] == 'reset-password') {
            UrlHelper.shared.clear()

            // Clear initial url before pushing to history, because else, when closing the popup, we'll get the original url...

            const token = queryString.get('token');
            const session = new Session(parts[1]);

            (this.$refs.modalStack as any).present({
                url: UrlHelper.transformUrl(currentPath),
                adjustHistory: false,
                components: [
                    new ComponentWithProperties(ForgotPasswordResetView, { initialSession: session, token }).setDisplayStyle("popup").setAnimated(false)
                ]
            });
        }

        if (parts.length >= 1 && parts[0] == 'login' && queryString.get("refresh_token") && queryString.get("organization_id")) {
            UrlHelper.shared.clear()
            const organizationId = queryString.get("organization_id")!
            const refreshToken = queryString.get("refresh_token")!
            
            this.loginWithToken(organizationId, refreshToken).catch(console.error)
        }

        if (parts.length == 1 && parts[0] == 'unsubscribe') {
            UrlHelper.shared.clear()
            const id = queryString.get('id')
            const token = queryString.get('token')
            const type = queryString.get('type') ?? 'all'

            if (id && token && ['all', 'marketing'].includes(type)) {
                this.unsubscribe(id, token, type as 'all'|'marketing').catch(console.error)
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
    }

    mounted() {
        // Update organization when opening an old tab again
        SessionManager.listenForOrganizationUpdates()

        ModalStackEventBus.addListener(this, "present", async (options: PushOptions | ComponentWithProperties) => {
            if (this.$refs.modalStack === undefined) {
                // Could be a webpack dev server error (HMR) (not fixable) or called too early
                await this.$nextTick()
            }
            if (!(options as any).components) {
                (this.$refs.modalStack as any).present({ components: [options] });
            } else {
                (this.$refs.modalStack as any).present(options)
            }
        })
        
        CenteredMessage.addListener(this, async (centeredMessage) => {
            if (this.$refs.modalStack === undefined) {
                // Could be a webpack dev server error (HMR) (not fixable) or called too early
                await this.$nextTick()
            }
            (this.$refs.modalStack as any).present({
                components: [
                    new ComponentWithProperties(CenteredMessageView, { centeredMessage }).setDisplayStyle("overlay")
                ]
            })
        })

        AppManager.shared.checkUpdates({
            visibleCheck: 'spinner',
            visibleDownload: true,
            installAutomatically: true
        }).catch(console.error)
    }

    async unsubscribe(id: string, token: string, type: 'all' | 'marketing') {
        const toast = new Toast("Bezig met uitschrijven...", "spinner").setHide(null).show()

        try {
            const response = await NetworkManager.server.request({
                method: "GET",
                path: "/email/manage",
                query: {
                    id,
                    token
                },
                decoder: EmailAddressSettings as Decoder<EmailAddressSettings>
            })

            const details = response.data
            toast.hide()

            let unsubscribe = true
            const fieldName = type === 'all' ? 'unsubscribedAll' : 'unsubscribedMarketing'

            if (details[fieldName]) {
                if (!await CenteredMessage.confirm("Je bent al uitgeschreven", "Terug inschrijven op e-mails", "Je ontvangt momenteel geen e-mails van "+(details.organization?.name ?? "Stamhoofd")+" op "+details.email+". Toch een e-mail ontvangen? Stuur hem door naar "+this.$t("shared.emails.complaints"))) {
                    return
                }

                unsubscribe = false
            } else {
                if (!await CenteredMessage.confirm("Wil je dat we jou geen e-mails meer sturen?", "Ja, uitschrijven", "Hierna ontvang je geen e-mails van "+(details.organization?.name ?? "Stamhoofd")+" op "+details.email)) {
                    return
                }
                toast.show()
            }

            await NetworkManager.server.request({
                method: "POST",
                path: "/email/manage",
                body: {
                    id,
                    token,
                    [fieldName]: unsubscribe
                }
            })
            toast.hide()

            if (unsubscribe) {
                new Toast("Top! Je ontvangt geen e-mails meer.", "success").setHide(15 * 1000).show()
            } else {
                new Toast("Je ontvangt vanaf nu terug e-mails.", "success").setHide(15 * 1000).show()
            }
            
        } catch (e) {
            console.error(e)
            toast.hide()
            Toast.fromError(e).show()
        }
    }

    /**
     * Login at a given organization, with the given refresh token
     */
    async loginWithToken(organizationId: string, refreshToken: string) {
        // TODO: add security toggle in system configuration to disable this feature
        if (!await CenteredMessage.confirm("Ben je zeker dat je wilt inloggen via deze link?", "Inloggen", "Klik op annuleren als je niet weet waar dit over gaat.")) {
            return
        }
        try {
            let session = await SessionManager.getSessionForOrganization(organizationId)
            if (!session) {
                session = new Session(organizationId)
            }

            if (session.user) {
                // Clear user
                session.user = null;
            }

            session.setToken(new Token({
                accessToken: "",
                refreshToken,
                accessTokenValidUntil: new Date(0)
            }))
            await SessionManager.setCurrentSession(session, false)           
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
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
