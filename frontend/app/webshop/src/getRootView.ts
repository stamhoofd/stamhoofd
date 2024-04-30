import { ComponentWithProperties, ModalStackComponent, NavigationController } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, ContextProvider } from "@stamhoofd/components";
import { OrganizationManager, Session } from "@stamhoofd/networking";
import { Webshop, WebshopAuthType } from "@stamhoofd/structures";

import { CheckoutManager } from "./classes/CheckoutManager";
import { WebshopManager } from "./classes/WebshopManager";
import RequiredLoginView from "./views/RequiredLoginView.vue";
import WebshopView from "./views/WebshopView.vue";
import {reactive, computed} from 'vue'

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
    const reactiveSession = reactive(session) as Session
    const $webshopManager = reactive(new WebshopManager(reactiveSession, webshop)) as WebshopManager;
    return new ComponentWithProperties(ContextProvider, {
        context: {
            $context: reactiveSession,
            $organizationManager: reactive(new OrganizationManager(reactiveSession)),
            $webshopManager,
            $checkoutManager: reactive(new CheckoutManager($webshopManager)),
        },
        calculatedContext: () => {
            return {
                $organization: computed(() => session.organization),
                $user: computed(() => session.user),
            }
        },
        root
    });
}