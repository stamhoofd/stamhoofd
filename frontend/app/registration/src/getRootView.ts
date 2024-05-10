import { ComponentWithProperties, ModalStackComponent, NavigationController, UrlHelper } from "@simonbackx/vue-app-navigation";
import { AccountSwitcher, AuthenticatedView, ContextProvider, OrganizationSwitcher, PromiseView, TabBarController, TabBarItem } from "@stamhoofd/components";
import { NetworkManager, OrganizationManager, SessionContext, SessionManager } from "@stamhoofd/networking";

import { CheckoutManager } from "./classes/CheckoutManager";
import { MemberManager } from "./classes/MemberManager";
import HomeView from './views/login/HomeView.vue';
import NewOverviewView from './views/overview/NewOverviewView.vue';
import { computed, reactive } from "vue";
import CartView from "./views/checkout/CartView.vue";
import { Country, Organization } from "@stamhoofd/structures";
import { Decoder } from "@simonbackx/simple-encoding";
import { I18nController } from "@stamhoofd/frontend-i18n";

export function wrapWithModalStack(...components: ComponentWithProperties[]) {
    return new ComponentWithProperties(ModalStackComponent, {initialComponents: components})
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
    
    await I18nController.loadDefault(session, "registration", Country.Belgium, "nl", session?.organization?.address?.country)
    
    if (!session || !session.organization) {
        const dashboard = await import('@stamhoofd/dashboard')
        return dashboard.getOrganizationSelectionRoot()
    }

    return getRootView(session)
}

export function getRootView(session: SessionContext) {
    const reactiveSession = reactive(session) as SessionContext
    const $memberManager = new MemberManager(reactiveSession);

    const loggedInRoot = new ComponentWithProperties(PromiseView, {
        promise: async () => {
            await $memberManager.loadMembers();
            try {
                await $memberManager.loadDocuments();
            } catch (e) {
                console.error(e)
            }

            return new ComponentWithProperties(NavigationController, { 
                root: new ComponentWithProperties(NewOverviewView, {})
            })
        }
    })

    const cartRoot = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(CartView, {})
    })

    const loggedOutRoot = new ComponentWithProperties(ModalStackComponent, {
        root: new ComponentWithProperties(HomeView, {}) 
    });

    const $checkoutManager = new CheckoutManager($memberManager)

    return new ComponentWithProperties(ContextProvider, {
        context: {
            $context: reactiveSession,
            $organizationManager: new OrganizationManager(reactiveSession),
            $memberManager,
            $checkoutManager,
            reactive_navigation_url: "leden/" + session.organization!.uri,
            reactive_components: {
                "tabbar-left": new ComponentWithProperties(OrganizationSwitcher, {}),
                "tabbar-right": new ComponentWithProperties(AccountSwitcher, {})
            },
            stamhoofd_app: 'registration',
        },
        root: new ComponentWithProperties(AuthenticatedView, {
            root: wrapWithModalStack(
                new ComponentWithProperties(TabBarController, {
                    tabs: [
                        new TabBarItem({
                            icon: 'home',
                            name: 'Start',
                            component: loggedInRoot
                        }),
                        new TabBarItem({
                            icon: 'basket',
                            name: 'Mandje',
                            component: cartRoot,
                            badge: computed(() => $checkoutManager.cart.count == 0 ? '' :$checkoutManager.cart.count.toFixed(0))
                        })
                    ],
                })
            ),
            loginRoot: wrapWithModalStack(
                loggedOutRoot
            )
        })
    });
}