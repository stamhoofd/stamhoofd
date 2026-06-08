import { ComponentWithProperties, ModalStackComponent, NavigationController } from '@simonbackx/vue-app-navigation';
import AuthenticatedView from '@stamhoofd/components/containers/AuthenticatedView.vue';
import ContextProvider from '@stamhoofd/components/containers/ContextProvider.vue';
import { OrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { PlatformManager } from '@stamhoofd/networking/PlatformManager';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { Webshop } from '@stamhoofd/structures';
import { WebshopAuthType } from '@stamhoofd/structures';
import { markRaw, reactive } from 'vue';
import { CheckoutManager } from './classes/CheckoutManager';
import { WebshopManager } from './classes/WebshopManager';
import RequiredLoginView from './views/RequiredLoginView.vue';
import WebshopView from './views/WebshopView.vue';

export async function wrapContext(
    context: SessionContext,
    app: 'webshop',
    root: ComponentWithProperties,
    options: { ownDomain?: boolean; webshop: Webshop },
) {
    const platformManager = await PlatformManager.createFromCache(context, app, true);

    const $webshopManager = reactive(new WebshopManager(context, platformManager.$platform, options.webshop) as any) as WebshopManager;
    const $checkoutManager = reactive(new CheckoutManager($webshopManager));

    return new ComponentWithProperties(ContextProvider, {
        context: markRaw({
            $context: context,
            $platformManager: platformManager,
            $organizationManager: new OrganizationManager(context),
            $webshopManager,
            $checkoutManager,
            reactive_components: {},
            stamhoofd_app: app,
        }),
        root,
    });
}

export function wrapWithModalStack(...components: ComponentWithProperties[]) {
    return new ComponentWithProperties(ModalStackComponent, { initialComponents: components });
}

export async function getWebshopRootView(session: SessionContext, webshop: Webshop) {
    // Do we need to require login?
    let root = wrapWithModalStack(new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(WebshopView, {}),
    }));

    if (webshop.meta.authType === WebshopAuthType.Required) {
        root = wrapWithModalStack(
            new ComponentWithProperties(AuthenticatedView, {
                root,
                loginRoot: wrapWithModalStack(new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(RequiredLoginView, {}),
                })),
            }),
        );
    }

    return wrapContext(session, 'webshop', root, {
        ownDomain: true,
        webshop,
    });
}
