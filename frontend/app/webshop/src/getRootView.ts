import { ComponentWithProperties, ModalStackComponent, NavigationController } from '@simonbackx/vue-app-navigation';
import { AuthenticatedView, ContextProvider } from '@stamhoofd/components';
import { OrganizationManager, PlatformManager, SessionContext } from '@stamhoofd/networking';
import { Webshop, WebshopAuthType } from '@stamhoofd/structures';
import { markRaw, reactive } from 'vue';

import { CheckoutManager } from './classes/CheckoutManager';
import { WebshopManager } from './classes/WebshopManager';
import RequiredLoginView from './views/RequiredLoginView.vue';
import WebshopView from './views/WebshopView.vue';

export function wrapWithModalStack(...components: ComponentWithProperties[]) {
    return new ComponentWithProperties(ModalStackComponent, { initialComponents: components });
}

export async function getWebshopRootView(session: SessionContext, webshop: Webshop) {
    // Do we need to require login?
    let root = wrapWithModalStack(new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(WebshopView, {}),
    }));

    if (webshop.meta.authType === WebshopAuthType.Required) {
        root = new ComponentWithProperties(AuthenticatedView, {
            root,
            loginRoot: wrapWithModalStack(new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(RequiredLoginView, {}),
            })),
        });
    }
    const platformManager = await PlatformManager.createFromCache(session, true);
    const $webshopManager = reactive(new WebshopManager(session, webshop) as any) as WebshopManager;

    const $context = session;
    const $platformManager = platformManager;
    const $organizationManager = reactive(new OrganizationManager(session));
    const $checkoutManager = reactive(new CheckoutManager($webshopManager));

    const rootView = new ComponentWithProperties(ContextProvider, {
        context: markRaw({
            $context,
            $platformManager,
            $organizationManager,
            $webshopManager,
            $checkoutManager,
            reactive_navigation_url: '/',
        }),
        root,
    });

    return rootView;
}
