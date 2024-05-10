import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, ModalStackComponent, NavigationController, UrlHelper } from "@simonbackx/vue-app-navigation";
import { AccountSwitcher, AuthenticatedView, ColorHelper, ContextProvider, OrganizationSwitcher, PromiseView, TabBarController, TabBarItem } from "@stamhoofd/components";
import { OrganizationLogo } from "@stamhoofd/components";
import { I18nController } from "@stamhoofd/frontend-i18n";
import { NetworkManager, OrganizationManager, SessionContext, SessionManager } from "@stamhoofd/networking";
import { Country, Organization } from "@stamhoofd/structures";
import { computed, reactive } from "vue";

import { CheckoutManager } from "./classes/CheckoutManager";
import { MemberManager } from "./classes/MemberManager";
import CartView from "./views/checkout/CartView.vue";
import HomeView from './views/login/HomeView.vue';
import NewOverviewView from './views/overview/NewOverviewView.vue';

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
        
    if (!session || !session.organization) {
        const dashboard = await import('@stamhoofd/dashboard')
        return dashboard.getOrganizationSelectionRoot()
    }

    return await getRootView(session)
}

export async function getRootView(session: SessionContext, ownDomain = false) {
    const reactiveSession = reactive(session) as SessionContext
    const $memberManager = new MemberManager(reactiveSession);
    await I18nController.loadDefault(reactiveSession, "registration", Country.Belgium, "nl", session?.organization?.address?.country)
    
    // Set color
    if (session.organization?.meta.color) {
        ColorHelper.setColor(session.organization?.meta.color)
    }

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
            reactive_navigation_url: ownDomain ? "" : "leden/" + session.organization!.uri,
            reactive_components: {
                "tabbar-left": ownDomain ? new ComponentWithProperties(OrganizationLogo, {
                    organization: reactiveSession.organization
                }) : new ComponentWithProperties(OrganizationSwitcher, {
                    disabled: ownDomain
                }),
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
