import { ComponentWithProperties, ModalStackComponent, NavigationController } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, ContextProvider } from "@stamhoofd/components";
import { OrganizationManager, Session } from "@stamhoofd/networking";
import { Webshop, WebshopAuthType } from "@stamhoofd/structures";

import { CheckoutManager } from "./classes/CheckoutManager";
import { WebshopManager } from "./classes/WebshopManager";
import RequiredLoginView from "./views/RequiredLoginView.vue";
import WebshopView from "./views/WebshopView.vue";

export function wrapWithModalStack(...components: ComponentWithProperties[]) {
    return new ComponentWithProperties(ModalStackComponent, {initialComponents: components})
}

export function getWebshopRootView(session: Session, webshop: Webshop) {
    // Do we need to require login?
    let root = wrapWithModalStack(new ComponentWithProperties(NavigationController, { 
        root: new ComponentWithProperties(WebshopView, {}) 
    }))
    
    if (webshop.meta.authType === WebshopAuthType.Required) {
        root = new ComponentWithProperties(AuthenticatedView, {
            root,
            loginRoot: wrapWithModalStack(new ComponentWithProperties(NavigationController, { 
                root: new ComponentWithProperties(RequiredLoginView, {}) 
            }))
        });
    }

    const $webshopManager = new WebshopManager(session, webshop);
    return new ComponentWithProperties(ContextProvider, {
        context: {
            $context: session,
            $organizationManager: new OrganizationManager(session),
            $webshopManager,
            $checkoutManager: new CheckoutManager($webshopManager),
        },
        calculatedContext: () => {
            return {
                $organization: session.organization,
                $user: session.user,
            }
        },
        root
    });
}