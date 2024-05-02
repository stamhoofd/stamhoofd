import { ComponentWithProperties, ModalStackComponent, NavigationController } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, ContextProvider, OrganizationSwitcher, PromiseView, TabBarController, TabBarItem } from "@stamhoofd/components";
import { OrganizationManager, Session } from "@stamhoofd/networking";

import { CheckoutManager } from "./classes/CheckoutManager";
import { MemberManager } from "./classes/MemberManager";
import HomeView from './views/login/HomeView.vue';
import NewOverviewView from './views/overview/NewOverviewView.vue';
import { computed, reactive } from "vue";
import CartView from "./views/checkout/CartView.vue";

export function wrapWithModalStack(...components: ComponentWithProperties[]) {
    return new ComponentWithProperties(ModalStackComponent, {initialComponents: components})
}

export function getRootView(session: Session) {
    const reactiveSession = reactive(session) as Session
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

    return new ComponentWithProperties(ContextProvider, {
        context: {
            $context: reactiveSession,
            $organizationManager: new OrganizationManager(reactiveSession),
            $memberManager,
            $checkoutManager: new CheckoutManager($memberManager),
            reactive_navigation_url: "leden/" + session.organization!.uri,
            reactive_components: {
                "tabbar-left": new ComponentWithProperties(OrganizationSwitcher, {})
            }
        },
        calculatedContext: () => {
            return {
                $organization: computed(() => reactiveSession.organization),
                $user: computed(() => reactiveSession.user),
            }
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
                            component: cartRoot
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