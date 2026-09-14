import { ComponentWithProperties, ModalStackComponent, NavigationController } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import AuthenticatedView from '@stamhoofd/components/containers/AuthenticatedView.vue';
import ContextProvider from '@stamhoofd/components/containers/ContextProvider.vue';
import { manualFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { OrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import { ThemeManager } from '@stamhoofd/networking/ThemeManager';
import type { Webshop } from '@stamhoofd/structures';
import { WebshopAuthType } from '@stamhoofd/structures';
import { markRaw, reactive } from 'vue';
import { CheckoutManager } from './classes/CheckoutManager';
import { WebshopManager } from './classes/WebshopManager';

export async function wrapContext(
    context: SessionContext,
    app: 'webshop',
    root: ComponentWithProperties,
    options: { ownDomain?: boolean; webshop: Webshop },
) {
    const themeManager = new ThemeManager(context, app);

    const $webshopManager = reactive(new WebshopManager(context, context.platform, options.webshop) as any) as WebshopManager;
    const $checkoutManager = reactive(new CheckoutManager($webshopManager));

    return new ComponentWithProperties(ContextProvider, {
        context: markRaw({
            $context: context,
            $themeManager: themeManager,
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
    // Organization feature flags live in privateMeta, which the public webshop never receives, so the flag can only be enabled on the platform.
    const modernView = manualFeatureFlag('modern-webshop', session, session.platform) || STAMHOOFD.environment === 'development';
    let root: ComponentWithProperties;
    if (modernView) {
        root = wrapWithModalStack(AsyncComponent(() => import('./views/WebshopController.vue'), {
            root: new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./views/ModernWebshopView.vue'), {}),
            }),
        }));
    } else {
        root = wrapWithModalStack(new ComponentWithProperties(NavigationController, {
            root: AsyncComponent(() => import('./views/WebshopView.vue'), {}),
        }));
    }

    // Do we need to require login?
    if (webshop.meta.authType === WebshopAuthType.Required) {
        root = wrapWithModalStack(
            new ComponentWithProperties(AuthenticatedView, {
                root,
                loginRoot: wrapWithModalStack(new ComponentWithProperties(NavigationController, {
                    root: AsyncComponent(() => import('./views/RequiredLoginView.vue'), {}),
                })),
            }),
        );
    }

    return wrapContext(session, 'webshop', root, {
        ownDomain: true,
        webshop,
    });
}
