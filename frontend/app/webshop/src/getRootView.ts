import { ComponentWithProperties, ModalStackComponent, NavigationController } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, ContextProvider } from "@stamhoofd/components";
import { OrganizationManager, SessionContext } from "@stamhoofd/networking";
import { Webshop, WebshopAuthType } from "@stamhoofd/structures";

import { computed, reactive } from 'vue';
import { CheckoutManager } from "./classes/CheckoutManager";
import { WebshopManager } from "./classes/WebshopManager";
import RequiredLoginView from "./views/RequiredLoginView.vue";
import WebshopView from "./views/WebshopView.vue";

export function wrapWithModalStack(...components: ComponentWithProperties[]) {
    return new ComponentWithProperties(ModalStackComponent, {initialComponents: components})
}

export function getWebshopRootView(session: SessionContext, webshop: Webshop) {
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
    const reactiveSession = reactive(session) as SessionContext
    const $webshopManager = reactive(new WebshopManager(reactiveSession, webshop)) as WebshopManager;
    return new ComponentWithProperties(ContextProvider, {
        context: {
            $context: reactiveSession,
            $organizationManager: reactive(new OrganizationManager(reactiveSession)),
            $webshopManager,
            $checkoutManager: reactive(new CheckoutManager($webshopManager)),
        },
        root
    });
}