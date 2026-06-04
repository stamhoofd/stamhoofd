import { AccountSwitcher, ContextNavigationBar, ContextProvider, CustomHooksContainer, OrganizationLogo, OrganizationSwitcher, ReplaceRootEventBus } from '@stamhoofd/components';
import { MemberManager, OrganizationManager, PlatformManager, UrlHelper } from '@stamhoofd/networking';
import type { Organization } from '@stamhoofd/structures';
import type { AppType } from '@stamhoofd/structures';
import { markRaw } from 'vue';
import { useGlobalRoutes } from './useGlobalRoutes';
import { ModalStackComponent, ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { sessionFromOrganization, sessionGlobal } from './sessionBuilders';

function wrapWithModalStack(component: ComponentWithProperties) {
    return new ComponentWithProperties(ModalStackComponent, { root: component });
}

export async function wrapAndReplace(organization: Organization | null = null, app: AppType, component: ComponentWithProperties, reactive_navigation_url: string) {
    const onOurDomain = UrlHelper.shared.url.host === STAMHOOFD.domains.dashboard || Object.values(STAMHOOFD.domains.registration ?? {}).includes(UrlHelper.shared.url.host);

    if ((STAMHOOFD.singleOrganization || organization?.resolvedRegisterDomain) && !onOurDomain) {
        // redirect to our domain
        // TODO
    }
    if (!STAMHOOFD.singleOrganization && organization?.resolvedRegisterDomain && UrlHelper.shared.url.host.toLowerCase() !== organization.resolvedRegisterDomain.toLowerCase()) {
        // redirect to org.resolvedRegisterDomain
        // TODO
    }

    const ownDomain = STAMHOOFD.singleOrganization || UrlHelper.shared.url.host !== STAMHOOFD.domains.dashboard;

    const context = organization ? await sessionFromOrganization(organization) : await sessionGlobal();

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
                'tabbar-left': ownDomain && context.organization
                    ? new ComponentWithProperties(OrganizationLogo, {
                        organization: context.organization,
                    })
                    : new ComponentWithProperties(OrganizationSwitcher, {}),
                'tabbar-right': new ComponentWithProperties(AccountSwitcher, {}),
                'tabbar-replacement': new ComponentWithProperties(ContextNavigationBar, {}),
            },
            stamhoofd_app: app,
            reactive_navigation_url,
        }),
        root: wrapWithModalStack(new ComponentWithProperties(CustomHooksContainer, {
            root: component,
            hooks: () => {
                useGlobalRoutes();
            },
        })),
    });

    await ReplaceRootEventBus.sendEvent('replace', root);
}
