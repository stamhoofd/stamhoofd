<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager, ModalStackComponent, PushOptions } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, CenteredMessageView, ColorHelper, ErrorBox, LoadingView, ModalStackEventBus, PromiseView, Toast, ToastBox } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { LoginHelper, NetworkManager, Session, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { GoogleTranslateHelper } from '@stamhoofd/utility';
import { Component, Vue } from "@simonbackx/vue-app-navigation/classes";

import { getRootView } from './getRootView';
import InvalidOrganizationView from './views/errors/InvalidOrganizationView.vue';

@Component({
    components: {
        ToastBox,
        ModalStackComponent
    },
})
export default class App extends Vue {
    promise = async () => {
        console.log("Fetching organization from domain...")

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

            // Do we need to redirect?
            if (window.location.hostname.toLowerCase() != response.data.resolvedRegisterDomain.toLowerCase()) {
                // Redirect
                window.location.href = UrlHelper.initial.getFullHref({ host: response.data.resolvedRegisterDomain })
                return new ComponentWithProperties(LoadingView, {})
            }
            I18nController.skipUrlPrefixForLocale = "nl-"+response.data.address.country
            
            if (!response.data.meta.modules.useMembers) {
                throw new Error("Member module disabled")
            }

            // Set organization and session
            const session = new Session(response.data.id)
            await session.loadFromStorage()       
            session.setOrganization(response.data)        
            await I18nController.loadDefault(session, "registration", response.data.address.country, "nl", response.data.address.country)
            


            document.title = "Schrijf je in bij "+response.data.name

            // Set color
            if (response.data.meta.color) {
                ColorHelper.setColor(response.data.meta.color)
            }

            await SessionManager.prepareSessionForUsage(session)

            const parts =  UrlHelper.shared.getParts()
            const queryString = UrlHelper.shared.getSearchParams()

            if (parts.length == 1 && parts[0] == 'verify-email') {

                const token = queryString.get('token')
                const code = queryString.get('code')
                    
                if (token && code) {
                    UrlHelper.shared.clear()
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

            return getRootView(session)
        } catch (e) {
            if (!I18nController.shared) {
                try {
                    await I18nController.loadDefault(null, "registration", undefined, "nl")
                } catch (e) {
                    console.error(e)
                }
            }
            if (isSimpleError(e) || isSimpleErrors(e)) {
                if (!(e.hasCode("invalid_domain") || e.hasCode("unknown_organization"))) {
                    Toast.fromError(e).show()

                    return new ComponentWithProperties(InvalidOrganizationView, {
                        errorBox: new ErrorBox(e)
                    })
                }
            }
            console.error(e)
            return new ComponentWithProperties(InvalidOrganizationView, {})
        }
    }

    root = new ComponentWithProperties(PromiseView, {
        promise: this.promise
    });

    created() {
        if (GoogleTranslateHelper.isGoogleTranslateDomain(window.location.hostname)) {
            // Enable translations
            document.documentElement.translate = true
        }

        if (STAMHOOFD.environment == "development") {
            ComponentWithProperties.debug = true
        }
        HistoryManager.activate();
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
    }
}
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "@stamhoofd/scss/main";
@import "@simonbackx/vue-app-navigation/dist/main.css";
</style>
