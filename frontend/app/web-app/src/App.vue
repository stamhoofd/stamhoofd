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
import { LoadingView } from '@stamhoofd/components';
import PromiseView from '@stamhoofd/components/containers/PromiseView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import CenteredMessageView from '@stamhoofd/components/overlays/CenteredMessageView.vue';
import { ModalStackEventBus, ReplaceRootEventBus } from '@stamhoofd/components/overlays/ModalStackEventBus.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import ToastBox from '@stamhoofd/components/overlays/ToastBox.vue';
import { getDashboardComponent } from '@stamhoofd/dashboard/src/getDashboardComponent';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { Storage } from '@stamhoofd/networking/Storage';
import { UrlHelper } from '@stamhoofd/networking/UrlHelper';
import getRegistrationComponent from '@stamhoofd/registration/src/getRegistrationComponent';
import { Organization, uriToApp } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';
import { getScopedSwitcherComponent, getUnscopedSwitcherComponent } from './getSwitcherComponents';
import { getAdminComponent } from '@stamhoofd/admin-frontend/src/getAdminComponent';

const modalStack = ref(null) as Ref<InstanceType<typeof ModalStackComponent> | null>;
HistoryManager.activate();
HistoryManager.debug = STAMHOOFD.environment === 'test';

if (STAMHOOFD.environment === 'development') {
    Error.stackTraceLimit = Infinity; // unlimited stack trace to debug infinite loops
}

const onOurDomain = window.location.hostname === STAMHOOFD.domains.dashboard || Object.values(STAMHOOFD.domains.registration ?? {}).includes(window.location.hostname);

function getRootComponent(app: string | undefined, org: Organization, isAdminPossible: boolean = false) {
    switch (app ? uriToApp(app) : undefined) {
        case 'dashboard':
            return getDashboardComponent(org);
        case 'registration':
            return getRegistrationComponent(org);
        case 'admin':
            if (isAdminPossible) {
                return getAdminComponent();
            }
    }
    return getScopedSwitcherComponent(org);
}

function redirectIfNeeded(org: Organization) {
    // Do we need to redirect?
    if (org.resolvedRegisterDomain && window.location.hostname.toLowerCase() !== org.resolvedRegisterDomain.toLowerCase()) {
        // Redirect
        window.location.href = UrlHelper.initial.getFullHref({ host: org.resolvedRegisterDomain });
        return new ComponentWithProperties(LoadingView, {});
    }
}
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

            if (STAMHOOFD.singleOrganization) {
                const org = await fetchOrganization({ path: '/organization', orgId: STAMHOOFD.singleOrganization });
                if (org) {
                    return getRootComponent(parts[1], org, true);
                }
                throw new Error('Failed to load organization for single organization mode');
            }

            if (onOurDomain) {
                // avoid unnecessary org fetching
                if (parts[0] && ['auto', 'registration', 'dashboard'].includes(uriToApp(parts[0]))) {
                    const org = await fetchOrganization({ path: '/organization-from-uri', query: { uri: parts[1] } });

                    if (org) {
                        redirectIfNeeded(org);

                        return getRootComponent(parts[0], org);
                    }
                }
                return getUnscopedSwitcherComponent();
            }

            if (STAMHOOFD.userMode === 'organization') {
                const org = await fetchOrganization({ path: '/organization-from-domain', query: { domain: window.location.hostname } });

                if (org) {
                    redirectIfNeeded(org);

                    return getRootComponent(parts[0], org);
                }
                throw new Error('No organization found for the given domain');
            }
            throw new Error('Custom organization domains are not supported in platform mode');
        } catch (e) {
            console.error('Error in Switcher.App promise', e);
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
