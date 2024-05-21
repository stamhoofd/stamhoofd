import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, ModalStackComponent, NavigationController, UrlHelper } from "@simonbackx/vue-app-navigation";
import { AccountSwitcher, AuthenticatedView, ColorHelper, ContextNavigationBar, ContextProvider, OrganizationLogo, OrganizationSwitcher, TabBarController, TabBarItem } from "@stamhoofd/components";
import { getLoginRoot } from "@stamhoofd/dashboard";
import { I18nController } from "@stamhoofd/frontend-i18n";
import { NetworkManager, OrganizationManager, SessionContext, SessionManager } from "@stamhoofd/networking";
import { Country, Organization } from "@stamhoofd/structures";
import { inject, reactive, markRaw } from "vue";

import { MemberManager } from "./classes/MemberManager";
import CartView from "./views/cart/CartView.vue";
import StartView from "./views/start/StartView.vue";

export function wrapWithModalStack(...components: ComponentWithProperties[]) {
    return new ComponentWithProperties(ModalStackComponent, {initialComponents: components})
}

export function useMemberManager() {
    return inject('$memberManager') as MemberManager;
}

export async function getScopedRegistrationRootFromUrl() {
    // UrlHelper.fixedPrefix = "beheerders";
    const parts = UrlHelper.shared.getParts();
    const ignoreUris = ['login'];

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

            // UrlHelper.fixedPrefix = "beheerders/" + organization.uri;

        } catch (e) {
            console.error('Failed to load organization from uri', uri);
        }
    }
        
    if (!session || !session.organization) {
        const dashboard = await import('@stamhoofd/dashboard')
        return dashboard.getOrganizationSelectionRoot()
    }

    return await getRootView(session)
}

export async function getRootView(session: SessionContext, ownDomain = false) {
    const reactiveSession = reactive(session as any) as SessionContext
    await I18nController.loadDefault(reactiveSession, Country.Belgium, "nl", session?.organization?.address?.country)
    
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

    //const $checkoutManager = new CheckoutManager($memberManager)

    const $memberManager = reactive(new MemberManager(reactiveSession));
    await $memberManager.loadMembers()

    return new ComponentWithProperties(ContextProvider, {
        context: markRaw({
            $context: reactiveSession,
            $organizationManager: new OrganizationManager(reactiveSession),
            $memberManager,
            //$checkoutManager,
            reactive_navigation_url: ownDomain ? "" : "leden/" + session.organization!.uri,
            reactive_components: {
                "tabbar-left": ownDomain ? new ComponentWithProperties(OrganizationLogo, {
                    organization: reactiveSession.organization
                }) : new ComponentWithProperties(OrganizationSwitcher, {
                    disabled: ownDomain
                }),
                "tabbar-right": new ComponentWithProperties(AccountSwitcher, {}),
                "tabbar-replacement": new ComponentWithProperties(ContextNavigationBar, {})
            },
            stamhoofd_app: 'registration',
        }),
        root: new ComponentWithProperties(AuthenticatedView, {
            root: wrapWithModalStack(
                new ComponentWithProperties(TabBarController, {
                    tabs: [
                        new TabBarItem({
                            icon: 'home',
                            name: 'Start',
                            component: startView
                        }),
                        new TabBarItem({
                            icon: 'basket',
                            name: 'Mandje',
                            component: cartRoot,
                            badge: '' //computed(() => $checkoutManager.cart.count == 0 ? '' :$checkoutManager.cart.count.toFixed(0))
                        })
                    ],
                })
            ),
            loginRoot: wrapWithModalStack(
                getLoginRoot()
            )
        })
    });
}
