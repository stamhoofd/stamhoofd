<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import type { PushOptions } from '@simonbackx/vue-app-navigation';
import { ComponentWithProperties, HistoryManager, ModalStackComponent, useManualPresent } from '@simonbackx/vue-app-navigation';
import { AccountSwitcher, AuthenticatedView, ContextNavigationBar, ContextProvider, CustomHooksContainer, OrganizationLogo, OrganizationSwitcher, RedirectView } from '@stamhoofd/components';
import PromiseView from '@stamhoofd/components/containers/PromiseView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import CenteredMessageView from '@stamhoofd/components/overlays/CenteredMessageView.vue';
import { ModalStackEventBus, ReplaceRootEventBus } from '@stamhoofd/components/overlays/ModalStackEventBus.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import ToastBox from '@stamhoofd/components/overlays/ToastBox.vue';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { Storage } from '@stamhoofd/networking/Storage';
import { UrlHelper } from '@stamhoofd/networking/UrlHelper';
import type { AppType, Webshop } from '@stamhoofd/structures';
import { Organization, uriToApp } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import type { Ref } from 'vue';
import { onMounted, onUnmounted, reactive, ref, markRaw } from 'vue';
import { MemberManager, OrganizationManager, PlatformManager, SessionManager } from '@stamhoofd/networking';
import { WebshopManager } from '../../webshop/src/classes/WebshopManager';
import { CheckoutManager } from '../../webshop/src/classes/CheckoutManager';
import { useGlobalRoutes } from './useGlobalRoutes';

const modalStack = ref(null) as Ref<InstanceType<typeof ModalStackComponent> | null>;
HistoryManager.activate();
HistoryManager.debug = STAMHOOFD.environment === 'test';

if (STAMHOOFD.environment === 'development') {
    Error.stackTraceLimit = Infinity; // unlimited stack trace to debug infinite loops
}

const onOurDomain = window.location.hostname === STAMHOOFD.domains.dashboard || Object.values(STAMHOOFD.domains.registration ?? {}).includes(window.location.hostname);

async function sessionFromOrganization(data: ({ organization: Organization } | { organizationId: string })) {
    const session = await SessionContext.createFrom(data);
    await session.loadFromStorage();
    await session.checkSSO();
    if ('organization' in data) {
        // Up to date organization
        session.updateOrganization(data.organization);
        session._lastFetchedOrganization = new Date();
    }
    await SessionManager.prepareSessionForUsage(session, false);
    return session;
}

async function sessionGlobal() {
    return await SessionManager.getLastGlobalSession();
}

function wrapWithModalStack(component: ComponentWithProperties, initialPresents?: PushOptions[]) {
    return new ComponentWithProperties(ModalStackComponent, { root: component, initialPresents });
}

async function wrapContext(context: SessionContext, app: AppType, buildComponent: ComponentWithProperties | ((data: { platformManager: PlatformManager }) => ComponentWithProperties | Promise<ComponentWithProperties>), options?: { ownDomain?: boolean; initialPresents?: PushOptions[]; webshop?: Webshop }) {
    const platformManager = await PlatformManager.createFromCache(context, app, true);
    const $memberManager = new MemberManager(context, platformManager.$platform);

    if (app === 'webshop' && !options?.webshop) {
        throw new Error('Webshop is required for webshop app');
    }

    const $webshopManager = options?.webshop ? reactive(new WebshopManager(context, platformManager.$platform, options.webshop) as any) as WebshopManager : null;
    const $checkoutManager = $webshopManager ? reactive(new CheckoutManager($webshopManager)) : null;

    const component = typeof buildComponent === 'function' ? await buildComponent({ platformManager }) : buildComponent;

    // BENJAMIN's TODO
    // const OrganizationSelector = import('@stamhoofd/organization-selector/OrganizationSelector');
    // const AccountSwitcher = import('@stamhoofd/auth/AccountSelector');

    return new ComponentWithProperties(ContextProvider, {
        context: markRaw({
            $context: context,
            $platformManager: platformManager,
            $memberManager,
            $organizationManager: new OrganizationManager(context),
            $webshopManager,
            $checkoutManager,
            reactive_components: {
                'tabbar-left': options?.ownDomain && context.organization
                    ? new ComponentWithProperties(OrganizationLogo, {
                        organization: context.organization,
                    })
                    : new ComponentWithProperties(OrganizationSwitcher, {}),
                'tabbar-right': new ComponentWithProperties(AccountSwitcher, {}),
                'tabbar-replacement': new ComponentWithProperties(ContextNavigationBar, {}),
            },
            stamhoofd_app: app,
            // apps, BENJAMIN's TODO
            // reactive_navigation_url: url, BENJAMIN's TODO
        }),
        root: wrapWithModalStack(new ComponentWithProperties(CustomHooksContainer, {
            root: component,
            hooks: () => {
                useGlobalRoutes();
                // Since we mounted, clear the inititial presents
                onUnmounted(() => {
                    // Clear the initial presents again, so that we don't keep them in memory
                    if (options?.initialPresents) {
                        console.log('Clearing initial presents', options.initialPresents);
                        options?.initialPresents?.splice(0);
                    }
                });
            },
        }), options?.initialPresents),
    });
}

async function start(app: AppType, root: ComponentWithProperties, organization: Organization | null) {
    if (organization && organization.resolvedRegisterDomain && window.location.hostname.toLowerCase() !== organization.resolvedRegisterDomain.toLowerCase()) {
        // Redirect
        return new ComponentWithProperties(RedirectView, {
            location: UrlHelper.initial.getFullHref({ host: organization.resolvedRegisterDomain }),
        });
    }

    if (!organization && !onOurDomain) {
        // Redirect
        return new ComponentWithProperties(RedirectView, {
            location: UrlHelper.initial.getFullHref({ host: STAMHOOFD.domains.dashboard }), // BENJAMIN's TODO this is faulty
        });
    }

    const session = organization ? await sessionFromOrganization({ organization }) : await sessionGlobal();

    return await wrapContext(session, app, root/* BENJAMIN's TODO options.ownDomain etc... */);
}

async function auth(root: ComponentWithProperties, organization: Organization | null) {
    const loginRoot = !organization && STAMHOOFD.userMode === 'organization'
        ? await import('@stamhoofd/organization-selector/root')
        : await import('@stamhoofd/auth/root');

    return new ComponentWithProperties(AuthenticatedView, {
        root: wrapWithModalStack(root),
        loginRoot: wrapWithModalStack(loginRoot),
    });
}

const apps: Record<AppType, any> = {
    'dashboard': async (organization: Organization | null) => {
        if (!organization) {
            throw new Error('Organization is required for dashboard app');
        }
        const dashboard = await import('@stamhoofd/dashboard');
        return start('dashboard', await auth(await dashboard.getApp(organization), organization), organization);
    },
    'registration': async (organization: Organization | null) => {
        const registration = await import('@stamhoofd/registration');
        return start('registration', await auth(await registration.getApp(organization), organization), organization);
    },
    'admin': async (organization: Organization | null) => {
        // organization might be not null, in case of single organization mode
        const admin = await import('@stamhoofd/admin');
        return start('admin', await auth(await admin.getApp(organization), organization), organization);
    },
    'auto-switcher': async (organization: Organization | null) => {
        const autoSwitcher = await import('@stamhoofd/auto-switcher');
        return start('auto-switcher', await auth(await autoSwitcher.getApp(organization), organization), organization);
    },
    'organization-selector': async (organization: Organization | null) => {
        if (organization) {
            throw new Error('Organization should not be set for organization selector app');
        }
        const organizationSelector = await import('@stamhoofd/organization-selector');
        return start('organization-selector', await auth(await organizationSelector.getApp(), null), null);
    },
    'auth': async (organization: Organization | null) => {

    },
    'webshop': async (organization: Organization | null) => {
        // BENJAMIN's TODO: what should we do here?
    },
};

async function fetchOrganization({ path, query, orgId }: { path: string; query?: Record<string, string>; orgId?: string }): Promise<Organization | null> {
    // If we have the token, we better do an authenticated request
    const server = orgId ? SessionContext.serverForOrganization(orgId) : NetworkManager.server;
    try {
        console.log(query);
        const response = await server.request({
            method: 'GET',
            path,
            query,
            decoder: Organization as Decoder<Organization>,
        });
        return response.data;
    } catch (e) {
        console.error('Failed to fetch organization', e);
        return null;
    }
}

async function idToOrganization(orgId: string) {
    return await fetchOrganization({ path: '/organization', orgId });
}

async function uriToOrganization(uri: string) {
    return await fetchOrganization({ path: '/organization-from-uri', query: { uri } });
}

async function domainToOrganization(domain: string) {
    return await fetchOrganization({ path: '/organization-from-domain', query: { domain } });
}

const root = new ComponentWithProperties(PromiseView, {
    promise: async () => {
        // Load locales first
        try {
            await I18nController.loadDefault(null, Country.Belgium, Language.Dutch);
        } catch (e) {
            console.error('Failed to load default locale', e);
        }

        try {
            let parts = UrlHelper.shared.getParts();

            // Check mollie oauth redirect replacement
            // We cannot customize the redirect url for Mollie, but that causes us not to know to which organization url we need to redirect after oauth
            if (parts[0] === 'oauth' && parts[1] === 'mollie') {
                const savedRedirectUrl = await Storage.keyValue.getItem('mollie-saved-redirect-url');
                if (savedRedirectUrl) {
                    // Redirect to the saved URL (removing /oauth/mollie)
                    UrlHelper.shared.url.pathname = savedRedirectUrl;
                    console.log('Redirecting to saved mollie redirect url', savedRedirectUrl);
                    parts = UrlHelper.shared.getParts();
                } else {
                    console.warn('No saved mollie redirect url found');
                }
            }

            /**
             * onOurDomain && not single org:
             * - / → auto-switcher, unscoped
             * - /{app} → {app}, unscoped
             * - /{org} → auto-switcher, scoped
             * - /{org}/{app} → {app}, scoped

             * not onOurDomain || single org
             * - / → auto-switcher, scoped
             * - /{app} → {app}, scoped
             */

            let org: Organization | null;
            let appType: AppType;

            if (!onOurDomain || STAMHOOFD.singleOrganization) {
                appType = parts[0] ? uriToApp(parts[0]) ?? 'auto-switcher' : 'auto-switcher';
                org = STAMHOOFD.singleOrganization ? await idToOrganization(STAMHOOFD.singleOrganization) : await domainToOrganization(window.location.hostname);
                if (!org) {
                    throw new Error(STAMHOOFD.singleOrganization ? 'Failed to load organization for single organization mode' : 'No organization found for the given domain');
                }
            } else {
                const possibleApp = parts[0] ? uriToApp(parts[0]) : null;
                if (possibleApp) {
                    appType = possibleApp;
                    org = null;
                } else {
                    const possibleOrg = parts[0] ? await uriToOrganization(parts[0]) : null;
                    if (possibleOrg) {
                        appType = parts[1] ? uriToApp(parts[1]) ?? 'auto-switcher' : 'auto-switcher';
                        org = possibleOrg;
                    } else {
                        appType = 'auto-switcher';
                        org = null;
                    }
                }
            }

            console.log('Determined app type', appType, 'and organization', org);
            return (apps[appType] ?? apps['auto-switcher'])(org);
        } catch (e) {
            console.error('Error in App promise', e);
            Toast.fromError(e).setHide(null).show();
            throw e;
        }
    },
}).setCheckRoutes();

const manualPresent = useManualPresent();

onMounted(async () => {
    if (!modalStack.value) {
        throw new Error('Modal stack not loaded');
    }

    const stack = modalStack.value;
    ModalStackEventBus.addListener(this, 'present', async (options: PushOptions | ComponentWithProperties) => {
        if (!(options as any).components) {
            await manualPresent(stack.present, { components: [options as ComponentWithProperties] });
        } else {
            await manualPresent(stack.present, options);
        }
    });

    ReplaceRootEventBus.addListener(this, 'replace', async (component: ComponentWithProperties) => {
        component.setCheckRoutes();
        stack.replace(component, false);
    });

    CenteredMessage.addListener(this, async (centeredMessage) => {
        await manualPresent(stack.present, {
            components: [
                new ComponentWithProperties(CenteredMessageView, {
                    centeredMessage,
                }, {
                    forceCanHaveFocus: true,
                }),
            ],
            modalDisplayStyle: 'overlay',
        });
    });

    // First check updates, and only after that, check for global routes
    // reason: otherwise the checkUpdates will dismiss the modal stack, and that can hide the reset password view instead of the update view
    try {
        await AppManager.shared.checkUpdates({
            visibleCheck: 'spinner',
            visibleDownload: true,
            installAutomatically: true,
        });
    } catch (e) {
        console.error(e);
    }
});

</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "@stamhoofd/scss/main";
@use "@stamhoofd/scss/base/dark-modus";
@use "@simonbackx/vue-app-navigation/dist/main.css" as VueAppNavigation;

html {
    -webkit-touch-callout:none;
    //user-select: none;
    -webkit-tap-highlight-color: rgba(0,0,0,0);
    -webkit-tap-highlight-color: transparent;
}
</style>
