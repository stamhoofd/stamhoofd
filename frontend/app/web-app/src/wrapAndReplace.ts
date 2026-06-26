import { ComponentWithProperties, ModalStackComponent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import AccountSwitcher from '@stamhoofd/components/context/AccountSwitcher.vue';
import ContextNavigationBar from '@stamhoofd/components/context/ContextNavigationBar.vue';
import ContextProvider from '@stamhoofd/components/containers/ContextProvider.vue';
import CustomHooksContainer from '@stamhoofd/components/containers/CustomHooksContainer.vue';
import OrganizationSwitcher from '@stamhoofd/components/context/OrganizationSwitcher.vue';
import { ReplaceRootEventBus } from '@stamhoofd/components/overlays/ModalStackEventBus';
import { MemberManager } from '@stamhoofd/networking/MemberManager';
import { OrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { PlatformManager } from '@stamhoofd/networking/PlatformManager';
import { UrlHelper } from '@stamhoofd/networking/UrlHelper';
import type { AppType, Organization } from '@stamhoofd/structures';
import { markRaw } from 'vue';
import type { Ref } from 'vue';
import { sessionFromOrganization, sessionGlobal } from './sessionBuilders';
import { useGlobalRoutes } from './useGlobalRoutes';
import { AppManager } from '@stamhoofd/networking/AppManager';

function wrapWithModalStack(component: ComponentWithProperties) {
    return new ComponentWithProperties(ModalStackComponent, { root: component });
}
export type SharedOptions = { url?: string | null | Ref<string | null>; query?: URLSearchParams | null | Ref<URLSearchParams | null>; checkRoutes?: boolean };

export async function wrap(organization: Organization | null = null, app: AppType, component: ComponentWithProperties, options?: SharedOptions) {
    const onOurDomain = AppManager.shared.isOnDashboardDomain || Object.values(STAMHOOFD.domains.registration ?? {}).includes(UrlHelper.shared.url.host);

    const context = organization ? await sessionFromOrganization(organization) : await sessionGlobal();

    let expectedHost = '';
    if ((STAMHOOFD.singleOrganization || organization === null || organization.resolvedRegisterDomain === null) && !onOurDomain) {
        expectedHost = STAMHOOFD.domains.dashboard;
    }
    if (!STAMHOOFD.singleOrganization && organization && organization.resolvedRegisterDomain) {
        expectedHost = organization.resolvedRegisterDomain;
    }
    if (expectedHost !== '' && context.canGetCompleted() && AppManager.shared.isOnDashboardDomain) {
        // if we are already logged in & we are on dashboard domain
        // (due to userMode platform, or because we are global admin, or because we are in the app)
        // we do not redirect
        expectedHost = '';
    }
    if (expectedHost !== '' && expectedHost.toLowerCase() !== UrlHelper.shared.url.host.toLowerCase()) {
        const helper = new UrlHelper(UrlHelper.shared.url.href);

        helper.setDomain(expectedHost); // keep path and query params, but change domain
        if (options?.url) {
            const routeUrl = typeof options.url === 'string' ? options.url : (options.url.value ?? '');
            if (routeUrl) {
                // The target domain identifies the org by domain/subdomain, not by path.
                // Strip the org URI from the path and keep only the app-type prefix (e.g.
                // 'beheerders') plus any sub-paths beyond the outer route match (e.g. 'reset-password').
                const currentParts = UrlHelper.shared.getParts();
                const routeParts = routeUrl.split('/').filter(Boolean);
                // Sub-paths are the parts beyond the outer route match (current URL may have more path
                // than what the outer route matched, e.g. /reset-password after /beheerders/{org-uri}).
                const subParts = routeParts.every((part, i) => currentParts[i] === part)
                    ? currentParts.slice(routeParts.length)
                    : [];
                const appPrefix = routeParts[0] ?? '';
                helper.setPath(UrlHelper.transformUrl([appPrefix, ...subParts].filter(Boolean).join('/')));
            }
        }

        return AsyncComponent(() => import('@stamhoofd/components/auth/RedirectView.vue'), {
            location: helper.url.href,
        });
    }

    const platformManager = await PlatformManager.createFromCache(context, app, true);
    const $memberManager = new MemberManager(context, platformManager.$platform);

    if (app === 'webshop') {
        throw new Error('Webshop should not be loaded through the web-app');
    }

    const root = new ComponentWithProperties(ContextProvider, {
        context: markRaw({
            $context: context,
            $platformManager: platformManager,
            $memberManager,
            $organizationManager: new OrganizationManager(context),
            reactive_components: {
                'tabbar-left': new ComponentWithProperties(OrganizationSwitcher, {}),
                'tabbar-right': new ComponentWithProperties(AccountSwitcher, {}),
                'tabbar-replacement': new ComponentWithProperties(ContextNavigationBar, {}),
            },
            stamhoofd_app: app,
            reactive_navigation_url: options?.url,
            reactive_navigation_query: options?.query,
        }),
        root: wrapWithModalStack(new ComponentWithProperties(CustomHooksContainer, {
            root: component,
            hooks: () => {
                useGlobalRoutes();
            },
        })),
    });

    return root;
}

export async function wrapAndReplace(organization: Organization | null = null, app: AppType, component: ComponentWithProperties, options: SharedOptions) {
    const root = await wrap(organization, app, component, options);
    if (options.checkRoutes) {
        root.setCheckRoutes();
    }

    await ReplaceRootEventBus.sendEvent('replace', root);
}
