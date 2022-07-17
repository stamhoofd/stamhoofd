<template>
    <div id="app">
        <PromiseView :promise="promise" />
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager, ModalStackComponent, NavigationController } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, CenteredMessage, ColorHelper, ErrorBox, LoadingView, PromiseView, Toast, ToastBox } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { LoginHelper, NetworkManager, Session, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { GoogleTranslateHelper, sleep } from '@stamhoofd/utility';
import { Component, Vue } from "vue-property-decorator";

import { CheckoutManager } from './classes/CheckoutManager';
import { MemberManager } from './classes/MemberManager';
import { TabBarItem } from "./classes/TabBarItem";
import InvalidOrganizationView from './views/errors/InvalidOrganizationView.vue';
import HomeView from './views/login/HomeView.vue';
import RegistrationTabBarController from './views/overview/RegistrationTabBarController.vue';

async function getDefaultView() {
    //if (MemberManager.members!.find(m => m.activeRegistrations.length > 0)) {
    //    return (await import(/* webpackChunkName: "RegistrationOverview" */ "./views/overview/OverviewView.vue")).default
    //}
    return (await import(/* webpackChunkName: "RegistrationOverview" */ "./views/overview/OverviewView.vue")).default;
}

async function getAccountView() {
    return (await import(/* webpackChunkName: "AccountSettingsView" */ "./views/account/AccountSettingsView.vue")).default;
}

async function getCartView() {
    return (await import(/* webpackChunkName: "CartView" */ "./views/checkout/CartView.vue")).default;
}

@Component({
    components: {
        ToastBox,
        PromiseView
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
            await I18nController.loadDefault("registration", response.data.address.country, "nl", response.data.address.country)

            if (!response.data.meta.modules.useMembers) {
                throw new Error("Member module disabled")
            }

            // Set organization and session
            const session = new Session(response.data.id)
            await session.loadFromStorage()       
            session.setOrganization(response.data)        
            
            document.title = "Schrijf je in bij "+response.data.name

            // Set color
            if (response.data.meta.color) {
                ColorHelper.setColor(response.data.meta.color)
            }

            await SessionManager.setCurrentSession(session)

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

            return new ComponentWithProperties(AuthenticatedView, {
                root: new ComponentWithProperties(PromiseView, {
                    promise: async () => {
                        await MemberManager.loadMembers();

                        const basket = new TabBarItem(
                            "Mandje",
                            "basket",
                            new ComponentWithProperties(NavigationController, { 
                                root: new ComponentWithProperties(await getCartView(), {}),
                            })
                        )
                        CheckoutManager.watchTabBar = basket
                        basket.badge = CheckoutManager.cart.count > 0 ? (CheckoutManager.cart.count + "") : null

                        return new ComponentWithProperties(ModalStackComponent, {
                            root: new ComponentWithProperties(RegistrationTabBarController, { 
                                items: [
                                    new TabBarItem(
                                        "Inschrijven",
                                        "edit",
                                        new ComponentWithProperties(NavigationController, { 
                                            root: new ComponentWithProperties(await getDefaultView(), {}),
                                        })
                                    ),
                                    new TabBarItem(
                                        "Account",
                                        "user",
                                        new ComponentWithProperties(NavigationController, { 
                                            root: new ComponentWithProperties(await getAccountView(), {}),
                                        })
                                    ),
                                    basket
                                ]
                            })
                        })
                    }
                }),
                loginRoot: new ComponentWithProperties(ModalStackComponent, {
                    root: new ComponentWithProperties(HomeView, {}) 
                })
            });
        } catch (e) {
            if (!I18nController.shared) {
                try {
                    await I18nController.loadDefault("registration", undefined, "nl")
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
        const ua = navigator.userAgent;

        if (ua.indexOf("FBAN") != -1 || ua.indexOf("FBAV") != -1) {
            new Toast("Je zit in de ingebouwde Facebook browser. Deze werkt minder goed en is minder veilig. We raden je héél sterk aan om over te schakelen naar je vaste browser. Dat kan via één van de knoppen boven of onderaan of door zelf naar de site te surfen.", "red error").setHide(null).show()
        }
    }
    
}
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "~@stamhoofd/scss/main";
@import "~@simonbackx/vue-app-navigation/dist/main.css";
</style>
