import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, ModalStackComponent, NavigationController, UrlHelper } from "@simonbackx/vue-app-navigation";
import { AccountSwitcher, AuthenticatedView, ColorHelper, ContextNavigationBar, ContextProvider, OrganizationLogo, OrganizationSwitcher, PromiseView, TabBarController, TabBarItem } from "@stamhoofd/components";
import { getNonAutoLoginRoot, wrapContext } from "@stamhoofd/dashboard";
import { I18nController } from "@stamhoofd/frontend-i18n";
import { NetworkManager, PlatformManager, SessionContext, SessionManager } from "@stamhoofd/networking";
import { Country, Organization } from "@stamhoofd/structures";
import { computed, inject, markRaw, reactive } from "vue";

import { MemberManager } from "./classes/MemberManager";
import CartView from "./views/cart/CartView.vue";
import EventsOverview from "./views/events/EventsOverview.vue";
import StartView from "./views/start/StartView.vue";

export function wrapWithModalStack(...components: ComponentWithProperties[]) {
    return new ComponentWithProperties(ModalStackComponent, {initialComponents: components})
}

export function useMemberManager() {
    return inject('$memberManager') as MemberManager;
}

export async function getScopedRegistrationRootFromUrl() {
    const parts = UrlHelper.shared.getParts();
    const ignoreUris = ['login', 'start'];

    let session: SessionContext|null = null;

    if (parts[0] === 'leden' && parts[1] && !ignoreUris.includes(parts[1])) {
        const uri = parts[1];

        // Load organization
        // todo: use cache
        try {
            const response = await NetworkManager.server.request({
                method: "GET",
                path: "/organization-from-uri",
                query: {
                    uri
                },
                decoder: Organization as Decoder<Organization>
            })
            const organization = response.data

            session = new SessionContext(organization)
            await session.loadFromStorage()
            await SessionManager.prepareSessionForUsage(session, false);
        } catch (e) {
            console.error('Failed to load organization from uri', uri);
        }
    }
        
    if (!session || !session.organization) {
        if (STAMHOOFD.userMode === 'platform' && parts[0] === 'leden') {
            session = new SessionContext(null)
            await session.loadFromStorage()
            await SessionManager.prepareSessionForUsage(session, true);
            return await getRootView(session)
        }
        const dashboard = await import('@stamhoofd/dashboard')
        return dashboard.getOrganizationSelectionRoot()
    }

    return await getRootView(session)
}

export async function getRootView(session: SessionContext, ownDomain = false) {
    await I18nController.loadDefault(session, Country.Belgium, "nl", session?.organization?.address?.country)

    // Set color
    if (session.organization?.meta.color && ownDomain) {
        ColorHelper.setColor(session.organization?.meta.color)
    }

    const startView = new ComponentWithProperties(NavigationController, { 
        root: new ComponentWithProperties(StartView, {})
    })

    const cartRoot = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(CartView, {})
    })
    
    const calendarTab = new TabBarItem({
        icon: 'calendar',
        name: 'Activiteiten',
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EventsOverview, {})
        })
    });

    return wrapContext(session, 'registration', new ComponentWithProperties(AuthenticatedView, {
        root: wrapWithModalStack(
            new ComponentWithProperties(PromiseView, {
                promise: async function (this: PromiseView) {
                    const $memberManager = this.$memberManager
                    await $memberManager.loadMembers()
                    await $memberManager.loadCheckout()

                    return new ComponentWithProperties(TabBarController, {
                        tabs: [
                            new TabBarItem({
                                icon: 'home',
                                name: 'Start',
                                component: startView
                            }),
                            calendarTab,
                            new TabBarItem({
                                icon: 'basket',
                                name: 'Mandje',
                                component: cartRoot,
                                badge: computed(() => $memberManager.family.checkout.cart.count == 0 ? '' : $memberManager.family.checkout.cart.count.toFixed(0))
                            })
                        ],
                    })
                }
            })
        ),
        loginRoot: wrapWithModalStack(
            getNonAutoLoginRoot(session)
        )
    }), {ownDomain});
}
