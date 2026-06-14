<template>
    <LoadingView />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, defineRoute, UrlHelper, useNavigate } from '@simonbackx/vue-app-navigation';
import LoadingView from '@stamhoofd/components/containers/LoadingView.vue';
import { provideAppNavigate } from '@stamhoofd/components/hooks/useAppNavigate';
import { ReplaceRootEventBus } from '@stamhoofd/components/overlays/ModalStackEventBus';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import type { Organization } from '@stamhoofd/structures';
import { AppRoute } from '@stamhoofd/structures';
import { domainToOrganization, idToOrganization, uriToOrganization } from './organizationLoaders';
import type { SharedOptions } from './wrapAndReplace';
import { wrap, wrapAndReplace } from './wrapAndReplace';

provideAppNavigate(useNavigate());

const isDashboardDomain = UrlHelper.shared.url.host === STAMHOOFD.domains.dashboard;

// false OR function to fetch the org from domain
const orgInDomain = !isDashboardDomain || STAMHOOFD.singleOrganization
    ? async () => {
        const org = STAMHOOFD.singleOrganization ? await idToOrganization(STAMHOOFD.singleOrganization) : await domainToOrganization(UrlHelper.shared.url.host);
        if (!org) {
            throw new Error(STAMHOOFD.singleOrganization ? 'Failed to load organization for single organization mode' : 'No organization found for the given domain');
        }
        return org;
    }
    : false;

// false OR params to aquire org from URI
const orgInUriParams = {
    params: { organizationUri: String },
    paramsToProps: async (params: { organizationUri: string }) => {
        const org = await uriToOrganization(params.organizationUri);
        if (!org) {
            Toast.error($t('Deze vereniging bestaat niet (meer)')).show();
            throw new Error('No organization found for the given URI, but required for this route');
        }
        return { organization: org };
    },
    propsToParams: (props: { organization: Organization }) => ({
        params: {
            organizationUri: props.organization.uri,
        },
        query: null,
    }),
};

async function loadAdmin(options: SharedOptions) {
    const admin = await import('@stamhoofd/admin-frontend');
    await wrapAndReplace(null, 'admin', new ComponentWithProperties(admin.App, {}), options);
}

async function loadDashboard(organization: Organization, options: SharedOptions) {
    const dashboard = await import('@stamhoofd/dashboard');
    console.error('Loading dashboard after', organization.clone());
    await wrapAndReplace(organization, 'dashboard', new ComponentWithProperties(dashboard.App, {}), options);
}

async function loadRegistration(organization: Organization | null, options: SharedOptions) {
    const registration = await import('@stamhoofd/registration');
    await wrapAndReplace(organization, 'registration', new ComponentWithProperties(registration.App, {}), options);
}

async function loadAuto(organization: Organization | null, options: SharedOptions) {
    console.error('Loading auto after', organization?.clone());
    const auto = await import('@stamhoofd/auto');
    return await wrap(organization, 'auto', new ComponentWithProperties(auto.App, {}), options);
}

async function showSpinner() {
    await ReplaceRootEventBus.sendEvent('replace', new ComponentWithProperties(LoadingView, {}));
}

async function loadVerifyEmail(organization: Organization | null, options: SharedOptions & { componentProperties: { token: string; email: string; code?: string } }) {
    const auth = await import('@stamhoofd/verify-email');
    await wrapAndReplace(organization, 'verify-email', new ComponentWithProperties(auth.App, options.componentProperties), options);
}

// ADMIN
if (UrlHelper.shared.url.host === STAMHOOFD.domains.dashboard) {
    defineRoute({
        name: AppRoute.Admin,
        url: $t('platform'),
        handler: async (options) => {
            await showSpinner();
            await loadAdmin(options);
        },
    });
}

// DASHBOARD
if (orgInDomain) {
    defineRoute({
        name: AppRoute.Dashboard,
        url: $t('beheerders'),
        handler: async (options) => {
            await showSpinner();
            await loadDashboard(await orgInDomain(), options);
        },
    });
} else {
    defineRoute<{ organizationUri: StringConstructor }, { organization: Organization }>({
        name: AppRoute.Dashboard,
        url: $t('beheerders') + '/@organizationUri',
        handler: async (options) => {
            await showSpinner();
            await loadDashboard(options.componentProperties.organization, options);
        },
        ...orgInUriParams,
    });
}

// REGISTRATION
if (orgInDomain) {
    defineRoute({
        name: AppRoute.OrgScopedRegistration,
        url: $t('leden'),
        handler: async (options) => {
            await showSpinner();
            await loadRegistration(await orgInDomain(), options);
        },
    });
} else {
    if (STAMHOOFD.userMode === 'platform') {
        const ignoreUris = [$t('berichten'), $t('start'), $t('mandje'), $t('activiteiten')];
        for (const uri of ignoreUris) {
            defineRoute({
                // no name, because we should not really reference these routes
                url: $t('leden') + '/' + uri,
                handler: async (options) => {
                    await showSpinner();
                    await loadRegistration(null, { ...options, url: $t('leden') });
                },
            });
        }
    }
    defineRoute<{ organizationUri: StringConstructor }, { organization: Organization }>({
        name: AppRoute.OrgScopedRegistration,
        url: $t('leden') + '/@organizationUri',
        handler: async (options) => {
            await showSpinner();
            await loadRegistration(options.componentProperties.organization, options);
        },
        ...orgInUriParams,
    });
    if (STAMHOOFD.userMode === 'platform') {
        defineRoute({
            name: AppRoute.UnscopedRegistration,
            url: $t('leden'),
            handler: async (options) => {
                await showSpinner();
                await loadRegistration(null, options);
            },
        });
    }
}

// VERIFY-EMAIL
if (orgInDomain) {
    defineRoute({
        name: AppRoute.VerifyEmail,
        url: $t('verify-email'),
        defaultProperties: query => ({
            token: query?.get('token') ?? '',
            email: query?.get('email') ?? '',
            code: query?.get('code') ?? undefined,
        }),
        component: async (options) => {
            await showSpinner();
            await loadVerifyEmail(await orgInDomain(), options);
        },
        propsToParams: props => ({
            query: props.code
                ? new URLSearchParams([
                        ['token', props.token],
                        ['email', props.email],
                        ['code', props.code],
                    ])
                : new URLSearchParams([
                        ['token', props.token],
                        ['email', props.email],
                    ]),
        }),
    });
} else if (STAMHOOFD.userMode === 'platform') {
    defineRoute({
        name: AppRoute.VerifyEmail,
        url: $t('verify-email'),
        defaultProperties: query => ({
            token: query?.get('token') ?? '',
            email: query?.get('email') ?? '',
            code: query?.get('code') ?? undefined,
        }),
        handler: async (options) => {
            await showSpinner();
            await loadVerifyEmail(null, options);
        },
        propsToParams: props => ({
            query: props.code
                ? new URLSearchParams([
                        ['token', props.token],
                        ['email', props.email],
                        ['code', props.code],
                    ])
                : new URLSearchParams([
                        ['token', props.token],
                        ['email', props.email],
                    ]),
        }),
    });
} else {
    defineRoute({
        name: AppRoute.VerifyEmail,
        url: 'verify-email/@organizationUri',
        params: { organizationUri: String },
        paramsToProps: async (params, query) => {
            await showSpinner();
            const org = await uriToOrganization(params.organizationUri);
            if (!org) {
                Toast.error($t('Kan je e-mailadres niet verifiëren: deze vereniging bestaat niet (meer)', { uri: params.organizationUri })).show();
                throw new Error('No organization found for the given URI, but required for this route');
            }
            if (!query?.get('token') || !query?.get('email')) {
                Toast.error($t('Kan je e-mailadres niet verifiëren: ongeldige link')).show();
                throw new Error('Token or email missing in query parameters for verify-email route');
            }
            console.log('Loaded verify email route with organization', org, 'and query', query);
            return {
                organization: org,
                token: query?.get('token') ?? '',
                email: query?.get('email') ?? '',
                code: query?.get('code') ?? undefined,
            };
        },
        propsToParams: props => ({
            params: {
                organizationUri: props.organization.uri,
            },
            query: props.code
                ? new URLSearchParams([
                        ['token', props.token],
                        ['email', props.email],
                        ['code', props.code],
                    ])
                : new URLSearchParams([
                        ['token', props.token],
                        ['email', props.email],
                    ]),
        }),
        handler: async (options) => {
            await showSpinner();
            await loadVerifyEmail(options.componentProperties.organization, options);
        },
    });
}

// AUTO (DEFAULT)
if (orgInDomain) {
    defineRoute({
        name: AppRoute.OrgScopedAuto,
        url: '',
        isDefault: {},
        force: true,
        replace: 100,
        component: async () => {
            return await loadAuto(await orgInDomain(), {});
        },
    });
} else {
    defineRoute<{ organizationUri: StringConstructor }, { organization: Organization }>({
        name: AppRoute.OrgScopedAuto,
        url: 'auto/@organizationUri',
        component: async (properties) => {
            return await loadAuto(properties.organization, {});
        },
        ...orgInUriParams,
    });
    defineRoute({
        name: AppRoute.UnscopedAuto,
        url: '',
        isDefault: {},
        force: true,
        replace: 100,
        component: async () => {
            return await loadAuto(null, {});
        },
    });
}

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
