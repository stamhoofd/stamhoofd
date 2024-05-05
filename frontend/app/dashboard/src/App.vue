<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, HistoryManager, ModalStackComponent, PushOptions } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, CenteredMessageView, ForgotPasswordResetView, ModalStackEventBus, PromiseView, ReplaceRootEventBus, Toast, ToastBox } from '@stamhoofd/components';
import { AppManager, LoginHelper, NetworkManager, Session, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { EmailAddressSettings, Token } from '@stamhoofd/structures';
import { Component, Vue, toNative } from 'vue-facing-decorator';

import { getScopedRegistrationRootFromUrl } from '@stamhoofd/registration';
import AdminApp from './AdminApp.vue';
import { getScopedDashboardRoot, getScopedDashboardRootFromUrl } from './getRootViews';

@Component({
    components: {
        ModalStackComponent,
        ToastBox
    },
})
export class App extends Vue {

    root = new ComponentWithProperties(PromiseView, {
        promise: async () => {
            try {
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

                let app: 'dashboard' | 'admin' | 'registration' = 'dashboard';

                const parts = UrlHelper.shared.getParts();
                if (parts.length >= 1 && parts[0] == 'admin') {
                    app = 'admin';
                } else if (parts.length >= 1 && parts[0] == 'beheerders') {
                    app = 'dashboard';
                } else if (parts.length >= 1 && parts[0] == 'leden') {
                    app = 'registration';
                }

                if (app == 'dashboard') {
                    return (await getScopedDashboardRootFromUrl())
                }
                
                if (app == 'admin') {
                    return new ComponentWithProperties(AdminApp, {})
                }

                return (await getScopedRegistrationRootFromUrl())
            } catch (e) {
                console.error(e)
                Toast.fromError(e).setHide(null).show()
                throw e
            }
        }
    }).setCheckRoutes()

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
                    .then(async () => {
                        toast.hide()
                        new Toast("E-mailadres is gevalideerd", "success green").show()

                        const dashboardContext = getScopedDashboardRoot(session)
                        await ReplaceRootEventBus.sendEvent("replace", dashboardContext);
                    }).catch(e => {
                        toast.hide()
                        CenteredMessage.fromError(e).addCloseButton().show()
                    })
            }
        }
    }

    mounted() {
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

        ReplaceRootEventBus.addListener(this, "replace", async (component: ComponentWithProperties) => {
            if (this.$refs.modalStack === undefined) {
                // Could be a webpack dev server error (HMR) (not fixable) or called too early
                await this.$nextTick()
            }
            (this.$refs.modalStack as any).replace(component, false)
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
            const session = await SessionManager.getContextForOrganization(organizationId)

            if (session.user) {
                // Clear user
                session.user = null;
            }

            session.setToken(new Token({
                accessToken: "",
                refreshToken,
                accessTokenValidUntil: new Date(0)
            }))
            await ReplaceRootEventBus.sendEvent("replace", getScopedDashboardRoot(session))
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
        }
    }
}

//Transform class component to vue native component
export default toNative(App)
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "@stamhoofd/scss/main";
@import "@stamhoofd/scss/base/dark-modus";
@import "@simonbackx/vue-app-navigation/dist/main.css";

html {
    -webkit-touch-callout:none;
    //user-select: none;
    -webkit-tap-highlight-color: rgba(0,0,0,0);
    -webkit-tap-highlight-color: transparent;
}
</style>
