<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, HistoryManager, ModalStackComponent, NavigationController, NavigationMixin, PushOptions } from "@simonbackx/vue-app-navigation";
import { getScopedAdminRootFromUrl } from '@stamhoofd/admin-frontend';
import { CenteredMessage, CenteredMessageView, ContextProvider, ForgotPasswordResetView, ModalStackEventBus, PaymentPendingView, PromiseView, RegistrationSuccessView, ReplaceRootEventBus, Toast, ToastBox } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { AppManager, LoginHelper, NetworkManager, PlatformManager, SessionContext, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { getScopedRegistrationRootFromUrl } from '@stamhoofd/registration';
import { EmailAddressSettings, PaymentGeneral, PaymentStatus, Token } from '@stamhoofd/structures';
import { Ref, nextTick, onMounted, reactive, ref, markRaw, Raw } from 'vue';
import { getScopedAutoRoot, getScopedAutoRootFromUrl, getScopedDashboardRoot, getScopedDashboardRootFromUrl } from "./getRootViews";

const modalStack = ref(null) as Ref<InstanceType<typeof ModalStackComponent>|null>;
HistoryManager.activate();
const $t = useTranslate();

const root = new ComponentWithProperties(PromiseView, {
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


            let app: 'dashboard' | 'admin' | 'registration' | 'auto' = 'auto';

            const parts = UrlHelper.shared.getParts();
            if (parts.length >= 1 && parts[0] == 'administratie') {
                app = 'admin';
            } else if (parts.length >= 1 && parts[0] == 'beheerders') {
                app = 'dashboard';
            } else if (parts.length >= 1 && parts[0] == 'leden') {
                app = 'registration';
            }

            let component: ComponentWithProperties
            if (app === 'auto') {
                component = (await getScopedAutoRootFromUrl())
            } else if (app == 'dashboard') {
                component =  (await getScopedDashboardRootFromUrl())
            } else if (app == 'admin') {
                component =  (await getScopedAdminRootFromUrl())
            } else {
                component =  (await getScopedRegistrationRootFromUrl())
            }

            // Check routes after mounting component
            checkGlobalRoutes().catch(console.error)
            return component
        } catch (e) {
            console.error(e)
            Toast.fromError(e).setHide(null).show()
            throw e
        }
    }
}).setCheckRoutes()

async function checkGlobalRoutes() {
    if (!modalStack.value) {
        await nextTick();
        return await checkGlobalRoutes();
    }

    const currentPath = UrlHelper.initial.getPath({ removeLocale: true })
    const parts = UrlHelper.initial.getParts();
    const queryString = UrlHelper.initial.getSearchParams()
    console.log('check global routes', parts, queryString, currentPath)

    if (parts.length > 0 && parts[0] == 'reset-password') {
        UrlHelper.shared.clear()

        // Clear initial url before pushing to history, because else, when closing the popup, we'll get the original url...

        const token = queryString.get('token');
        const session = reactive((parts[1] ? (await SessionContext.createFrom({organizationId: parts[1]})) : new SessionContext(null)) as Raw<SessionContext>) as SessionContext;
        const platformManager = await PlatformManager.createFromCache(session, false)
        modalStack.value.present({
            adjustHistory: false,
            components: [
                new ComponentWithProperties(ContextProvider, {
                    context: markRaw({
                        $context: session,
                        $platformManager: platformManager,
                        reactive_navigation_url: currentPath,
                    }),
                    root: new ComponentWithProperties(ForgotPasswordResetView, { token })
                })
            ],
            modalDisplayStyle: "popup",
            checkRoutes: true
        });
    }

    if (parts.length >= 1 && parts[0] == 'login' && queryString.get("refresh_token") && queryString.get("organization_id")) {
        const organizationId = queryString.get("organization_id")!
        const refreshToken = queryString.get("refresh_token")!
        
        await loginWithToken(organizationId, refreshToken)
    }

    if (parts.length == 1 && parts[0] == 'unsubscribe') {
        const id = queryString.get('id')
        const token = queryString.get('token')
        const type = queryString.get('type') ?? 'all'

        if (id && token && ['all', 'marketing'].includes(type)) {
            await unsubscribe(id, token, type as 'all'|'marketing')
        }
    }

    if (parts.length >= 1 && parts[0] == 'verify-email') {
        const token = queryString.get('token')
        const code = queryString.get('code')
            
        if (token && code) {
            const toast = new Toast("E-mailadres valideren...", "spinner").setHide(null).show()
            
            try {
                const session = reactive(parts[1] ? await SessionContext.createFrom({organizationId: parts[1]}) : new SessionContext(null)) as SessionContext;
                await session.loadFromStorage()
                await LoginHelper.verifyEmail(session, code, token)
                toast.hide()
                new Toast("E-mailadres is gevalideerd", "success green").show()

                const dashboardContext = await getScopedAutoRoot(session)
                await ReplaceRootEventBus.sendEvent("replace", dashboardContext);
            } catch (e) {
                toast.hide()
                CenteredMessage.fromError(e).addCloseButton().show()
            }
        }
    }

    if (queryString.get('paymentId')) {
        const paymentId = queryString.get('paymentId')
        const organizationId = queryString.get('organizationId')
            
        if (paymentId) {
            const cancel = queryString.get("cancel") === "true"
            const toast = new Toast("Betaling ophalen...", "spinner").setHide(null).show()
            let session: SessionContext
            
            try {
                session = reactive((organizationId ? (await SessionContext.createFrom({organizationId})) : new SessionContext(null)) as Raw<SessionContext>) as SessionContext;
                await session.loadFromStorage()
            } finally {
                toast.hide()
            }

            modalStack.value.present({
                adjustHistory: false,
                animated: false,
                force: true,
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: new ComponentWithProperties(PaymentPendingView, { 
                            server: session.authenticatedServer, 
                            paymentId,
                            cancel,
                            finishedHandler: async function(this: InstanceType<typeof NavigationMixin>, payment: PaymentGeneral | null) {
                                if (payment && payment.status == PaymentStatus.Succeeded) {
                                    // TODO: fetch appropriate data for this payment!
                                    
                                    if (payment.memberNames.length) {
                                        await this.show({
                                            components: [
                                                new ComponentWithProperties(RegistrationSuccessView, {
                                                    registrations: [] // todo: fetch registrations
                                                })
                                            ], 
                                            replace: 100, // autocorrects to all
                                            force: true
                                        })
                                    } else {
                                        await this.dismiss({force: true})
                                        new CenteredMessage("Betaling voltooid", "De betaling werd voltooid.").addCloseButton().show()
                                    }
                                } else {
                                    await this.dismiss({force: true})
                                    new CenteredMessage("Betaling mislukt", "De betaling werd niet voltooid of de bank heeft de betaling geweigerd. Probeer het opnieuw.").addCloseButton().show()
                                }
                            } 
                        })
                    })
                ],
                modalDisplayStyle: "popup"
            })
        }
    }
}


onMounted(() => {
    if (!modalStack.value) {
        throw new Error("Modal stack not loaded")
    }

    const stack = modalStack.value

    ModalStackEventBus.addListener(this, "present", async (options: PushOptions | ComponentWithProperties) => {
        if (!(options as any).components) {
            stack.present({ components: [options] });
        } else {
            stack.present(options)
        }
    })

    ReplaceRootEventBus.addListener(this, "replace", async (component: ComponentWithProperties) => {
        stack.replace(component, false)
    })
    
    CenteredMessage.addListener(this, async (centeredMessage) => {
        stack.present({
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
})

async function unsubscribe(id: string, token: string, type: 'all' | 'marketing') {
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
            if (!await CenteredMessage.confirm("Je bent al uitgeschreven", "Terug inschrijven op e-mails", "Je ontvangt momenteel geen e-mails van "+(details.organization?.name ?? "Stamhoofd")+" op "+details.email+". Toch een e-mail ontvangen? Stuur hem door naar "+$t("shared.emails.complaints"))) {
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
async function loginWithToken(organizationId: string, refreshToken: string) {
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

        await session.setToken(new Token({
            accessToken: "",
            refreshToken,
            accessTokenValidUntil: new Date(0)
        }))
        await SessionManager.prepareSessionForUsage(session, false)
        await ReplaceRootEventBus.sendEvent("replace", await getScopedDashboardRoot(session))
    } catch (e) {
        console.error(e)
        Toast.fromError(e).show()
    }
}
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
