<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, HistoryManager, ModalStackComponent, PushOptions } from "@simonbackx/vue-app-navigation";
import { getScopedAdminRootFromUrl } from '@stamhoofd/admin-frontend';
import { CenteredMessage, CenteredMessageView, ModalStackEventBus, PromiseView, ReplaceRootEventBus, Toast, ToastBox, uriToApp } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { AppManager, LoginHelper, NetworkManager, SessionContext, UrlHelper } from '@stamhoofd/networking';
import { getScopedRegistrationRootFromUrl } from '@stamhoofd/registration';
import { EmailAddressSettings, Platform } from '@stamhoofd/structures';
import { nextTick, onMounted, reactive, Ref, ref } from 'vue';
import { getScopedAutoRoot, getScopedAutoRootFromUrl, getScopedDashboardRootFromUrl } from "./getRootViews";

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
            if (parts.length >= 1) {
                app = uriToApp(parts[0])
            } else {
                app = 'auto';
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

            console.log('Resolved root component')
            return component
        } catch (e) {
            console.error('Error in dashboard.App promise', e)
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
}


onMounted(async () => {
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
        component.setCheckRoutes()
        stack.replace(component, false)
    })
    
    CenteredMessage.addListener(this, async (centeredMessage) => {
        stack.present({
            components: [
                new ComponentWithProperties(CenteredMessageView, { centeredMessage }).setDisplayStyle("overlay")
            ]
        })
    })

    // First check updates, and only after that, check for global routes
    // reason: otherwise the checkUpdates will dismiss the modal stack, and that can hide the reset password view instead of the update view
    try {
        await AppManager.shared.checkUpdates({
            visibleCheck: 'spinner',
            visibleDownload: true,
            installAutomatically: true
        })
    } catch (e) {
        console.error(e)
    }

    // Check routes
    checkGlobalRoutes().catch(console.error)

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
            if (!await CenteredMessage.confirm("Je bent al uitgeschreven", "Terug inschrijven op e-mails", "Je ontvangt momenteel geen e-mails van "+(details.organization?.name ?? Platform.shared.config.name)+" op "+details.email+". Toch een e-mail ontvangen? Stuur hem door naar "+$t("edac937d-5eda-445e-8bba-2c2b353d3f27"))) {
                return
            }

            unsubscribe = false
        } else {
            if (!await CenteredMessage.confirm("Wil je dat we jou geen e-mails meer sturen?", "Ja, uitschrijven", "Hierna ontvang je geen e-mails van "+(details.organization?.name ?? Platform.shared.config.name)+" op "+details.email)) {
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
