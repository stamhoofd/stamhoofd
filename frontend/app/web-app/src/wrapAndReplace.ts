import { ComponentWithProperties, ModalStackComponent } from '@simonbackx/vue-app-navigation';
import AccountSwitcher from '@stamhoofd/components/context/AccountSwitcher.vue';
import ContextNavigationBar from '@stamhoofd/components/context/ContextNavigationBar.vue';
import ContextProvider from '@stamhoofd/components/containers/ContextProvider.vue';
import CustomHooksContainer from '@stamhoofd/components/containers/CustomHooksContainer.vue';
import OrganizationSwitcher from '@stamhoofd/components/context/OrganizationSwitcher.vue';
import { MemberManager } from '@stamhoofd/networking/MemberManager';
import { OrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { loadPlatform } from '@stamhoofd/networking/loadPlatform';
import { ThemeManager } from '@stamhoofd/networking/ThemeManager';
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

export async function wrap(organization: Organization | null = null, app: AppType, component: ComponentWithProperties) {
    const onOurDomain = AppManager.shared.isOnDashboardDomain || Object.values(STAMHOOFD.domains.registration ?? {}).includes(UrlHelper.shared.url.host);

    if ((STAMHOOFD.singleOrganization || organization?.resolvedRegisterDomain) && !onOurDomain) {
        // redirect to our domain
        // TODO
    }
    if (!STAMHOOFD.singleOrganization && organization?.resolvedRegisterDomain && UrlHelper.shared.url.host.toLowerCase() !== organization.resolvedRegisterDomain.toLowerCase()) {
        // redirect to org.resolvedRegisterDomain
        // TODO
    }

    // The platform has to exist before the session does, so resolve it first (from cache, or over
    // the network). This is the seam that becomes a tenant/domain lookup later.
    const { platform, fromCache } = await loadPlatform();
    const context = organization ? await sessionFromOrganization(organization, platform) : await sessionGlobal(platform);

    if (context.requiresPlatformPrivateConfig() && !context.platform.privateConfig) {
        // The bootstrapped platform is the public one, but this user needs the private config to
        // reliably calculate its permissions: upgrade it with an authenticated request.
        await context.fetchPlatform();
    } else if (fromCache) {
        // We served a platform that came from storage, so refresh it in the background.
        context.fetchPlatform().catch(console.error);
    }

    const themeManager = new ThemeManager(context, app);
    const $memberManager = new MemberManager(context, platform);

    if (app === 'webshop') {
        throw new Error('Webshop should not be loaded through the web-app');
    }

    const root = new ComponentWithProperties(ContextProvider, {
        context: markRaw({
            $context: context,
            $themeManager: themeManager,
            $memberManager,
            $organizationManager: new OrganizationManager(context),
            reactive_components: {
                'tabbar-left': new ComponentWithProperties(OrganizationSwitcher, {}),
                'tabbar-right': new ComponentWithProperties(AccountSwitcher, {}),
                'tabbar-replacement': new ComponentWithProperties(ContextNavigationBar, {}),
            },
            stamhoofd_app: app,
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
