<template>
    <LoadingView />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, defineRoute, UrlHelper, useNavigate } from '@simonbackx/vue-app-navigation';
import type { Organization } from '@stamhoofd/structures';
import { AppRoute } from '@stamhoofd/structures';
import { wrapAndReplace } from './wrapAndReplace';
import { domainToOrganization, idToOrganization, uriToOrganization } from './organizationLoaders';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { provideAppNavigate, ReplaceRootEventBus } from '@stamhoofd/components';
import LoadingView from '@stamhoofd/components/containers/LoadingView.vue';

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
const orgInUriParams = !orgInDomain
    ? {
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
                params: { organizationUri: props.organization.uri },
            }),
        }
    : false;

async function loadAdmin(uri: string) {
    const admin = await import('@stamhoofd/admin-frontend');
    await wrapAndReplace(null, 'admin', new ComponentWithProperties(admin.App, {}), uri);
}

async function loadDashboard(organization: Organization, uri: string) {
    const dashboard = await import('@stamhoofd/dashboard');
    console.error('Loading dashboard after', organization.clone());
    await wrapAndReplace(organization, 'dashboard', new ComponentWithProperties(dashboard.App, {}), uri);
}

async function loadRegistration(organization: Organization | null, uri: string) {
    const registration = await import('@stamhoofd/registration');
    await wrapAndReplace(organization, 'registration', new ComponentWithProperties(registration.App, {}), uri);
}

async function loadAuto(organization: Organization | null, uri: string) {
    console.error('Loading auto after', organization?.clone());
    const auto = await import('@stamhoofd/auto');
    await wrapAndReplace(organization, 'auto', new ComponentWithProperties(auto.App, {}), uri);
}

async function showSpinner() {
    await ReplaceRootEventBus.sendEvent('replace', new ComponentWithProperties(LoadingView, {}));
}

async function loadVerifyEmail(organization: Organization | null, uri: string, token: string, email: string, code?: string) {
    const auth = await import('@stamhoofd/verify-email');
    await wrapAndReplace(organization, 'verify-email', new ComponentWithProperties(auth.App, { token, email, code }), uri);
}

// ADMIN
if (UrlHelper.shared.url.host === STAMHOOFD.domains.dashboard) {
    defineRoute({
        name: AppRoute.Admin,
        url: $t('platform'),
        handler: async () => {
            await showSpinner();
            await loadAdmin($t('platform'));
        },
    });
}

// DASHBOARD
if (orgInDomain) {
    defineRoute({
        name: AppRoute.Dashboard,
        url: $t('beheerders'),
        handler: async () => {
            await showSpinner();
            await loadDashboard(await orgInDomain(), $t('beheerders'));
        },
    });
} else {
    defineRoute({
        name: AppRoute.Dashboard,
        url: $t('beheerders') + '/@organizationUri',
        handler: async ({ componentProperties }: { componentProperties: { organization: Organization } }) => {
            await showSpinner();
            await loadDashboard(componentProperties.organization, $t('beheerders') + '/' + componentProperties.organization.uri);
        },
        ...orgInUriParams,
    });
}

// REGISTRATION
if (orgInDomain) {
    defineRoute({
        name: AppRoute.OrgScopedRegistration,
        url: $t('leden'),
        handler: async () => {
            await showSpinner();
            await loadRegistration(await orgInDomain(), $t('leden'));
        },
    });
} else {
    if (STAMHOOFD.userMode === 'platform') {
        const ignoreUris = [$t('berichten'), $t('start'), $t('mandje'), $t('activiteiten')];
        for (const uri of ignoreUris) {
            defineRoute({
                name: AppRoute.UnscopedRegistration,
                url: $t('leden') + '/' + uri,
                handler: async () => {
                    await showSpinner();
                    await loadRegistration(null, $t('leden'));
                },
            });
        }
    }
    defineRoute({
        name: AppRoute.OrgScopedRegistration,
        url: $t('leden') + '/@organizationUri',
        handler: async ({ componentProperties }: { componentProperties: { organization: Organization } }) => {
            await showSpinner();
            await loadRegistration(componentProperties.organization, $t('leden') + '/' + componentProperties.organization.uri);
        },
        ...orgInUriParams,
    });
    if (STAMHOOFD.userMode === 'platform') {
        defineRoute({
            name: AppRoute.UnscopedRegistration,
            url: $t('leden'),
            handler: async () => {
                await showSpinner();
                await loadRegistration(null, $t('leden'));
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
        handler: async ({ componentProperties }) => {
            const { token, email, code } = componentProperties;
            await showSpinner();
            await loadVerifyEmail(await orgInDomain(), $t('verify-email'), token, email, code);
        },
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
        handler: async ({ componentProperties }) => {
            const { token, email, code } = componentProperties;
            await showSpinner();
            await loadVerifyEmail(null, $t('verify-email'), token, email, code);
        },
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
            params: { organizationUri: props.organization.uri },
        }),
        handler: async ({ componentProperties }) => {
            await showSpinner();
            const { organization, token, email, code } = componentProperties;
            console.log('Loading verify email for organization', organization, 'with token', token, 'and email', email);
            await loadVerifyEmail(organization, $t('verify-email') + '/' + organization.uri, token, email, code);
        },
    });
}

// AUTO (DEFAULT)
if (orgInDomain) {
    defineRoute({
        name: AppRoute.OrgScopedAuto,
        url: '',
        isDefault: {},
        handler: async () => {
            await showSpinner();
            await loadAuto(await orgInDomain(), '');
        },
    });
} else {
    defineRoute({
        name: AppRoute.OrgScopedAuto,
        url: 'auto/@organizationUri',
        handler: async ({ componentProperties }: { componentProperties: { organization: Organization } }) => {
            await showSpinner();
            await loadAuto(componentProperties.organization, $t('auto') + '/' + componentProperties.organization.uri);
        },
        ...orgInUriParams,
    });
    defineRoute({
        name: AppRoute.UnscopedAuto,
        url: '',
        isDefault: {},
        handler: async () => {
            await showSpinner();
            await loadAuto(null, '');
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
