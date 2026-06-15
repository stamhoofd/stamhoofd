<template>
    <LoadingView />
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, defineRoute, UrlHelper, useNavigate } from '@simonbackx/vue-app-navigation';
import LoadingView from '@stamhoofd/components/containers/LoadingView.vue';
import { provideAppNavigate } from '@stamhoofd/components/hooks/useAppNavigate';
import { ReplaceRootEventBus } from '@stamhoofd/components/overlays/ModalStackEventBus';
import type { Organization } from '@stamhoofd/structures';
import { AppRoute } from '@stamhoofd/structures';
import { domainToOrganization, idToOrganization, uriToOrganization } from './organizationLoaders';
import type { SharedOptions } from './wrapAndReplace';
import { wrap, wrapAndReplace } from './wrapAndReplace';

provideAppNavigate(useNavigate());

const isDashboardDomain = UrlHelper.shared.url.host === STAMHOOFD.domains.dashboard;

async function paramsToRequiredOrganization<T extends { organizationUri: string }>(params: T) {
    const org = await uriToOrganization(params.organizationUri);
    if (!org) {
        throw new SimpleError({
            code: 'invalid_field',
            field: 'organizationUrl',
            message: 'No organization found for the given URI, but required for this route',
            human: $t('Deze link is niet (meer) geldig omdat de vereniging niet bestaat', { uri: params.organizationUri }),
        });
    }
    return org;
}

function organizationToParams(organization: Organization): { organizationUri: string } {
    return {
        organizationUri: organization.uri,
    };
}

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
        return {
            organization: await paramsToRequiredOrganization(params),
        };
    },
    propsToParams: (props: { organization: Organization }) => ({
        params: organizationToParams(props.organization),
        query: null,
    }),
};

async function replaceWithAdmin(options: SharedOptions) {
    const admin = await import('@stamhoofd/admin-frontend');
    await wrapAndReplace(null, 'admin', new ComponentWithProperties(admin.App, {}), options);
}

async function replaceWithDashboard(organization: Organization, options: SharedOptions) {
    const dashboard = await import('@stamhoofd/dashboard');
    console.error('Loading dashboard after', organization.clone());
    await wrapAndReplace(organization, 'dashboard', new ComponentWithProperties(dashboard.App, {}), options);
}

async function replaceWithRegistration(organization: Organization | null, options: SharedOptions) {
    const registration = await import('@stamhoofd/registration');
    await wrapAndReplace(organization, 'registration', new ComponentWithProperties(registration.App, {}), options);
}

async function loadAuto(organization: Organization | null, options: SharedOptions) {
    console.error('Loading auto after', organization?.clone());
    const auto = await import('@stamhoofd/auto');
    return await wrap(organization, 'auto', new ComponentWithProperties(auto.App, {}), options);
}

async function replaceWithSpinner() {
    await ReplaceRootEventBus.sendEvent('replace', new ComponentWithProperties(LoadingView, {}));
}

async function loadVerifyEmail(organization: Organization | null, componentProperties: { token: string; email: string | null; code: string | null }) {
    const auth = await import('@stamhoofd/verify-email');
    return await wrap(organization, 'verify-email', new ComponentWithProperties(auth.App, componentProperties));
}

// ADMIN
if (UrlHelper.shared.url.host === STAMHOOFD.domains.dashboard) {
    defineRoute({
        name: AppRoute.Admin,
        url: $t('platform'),
        // TODO: move to component pattern (see verify-email)
        handler: async (options) => {
            await replaceWithSpinner();
            await replaceWithAdmin(options);
        },
    });
}

// DASHBOARD
if (orgInDomain) {
    defineRoute({
        name: AppRoute.Dashboard,
        url: $t('beheerders'),
        // TODO: move to component pattern (see verify-email)
        handler: async (options) => {
            await replaceWithSpinner();
            await replaceWithDashboard(await orgInDomain(), options);
        },
    });
} else {
    defineRoute({
        name: AppRoute.Dashboard,
        url: $t('beheerders') + '/@organizationUri',
        // TODO: move to component pattern (see verify-email)
        handler: async (options) => {
            await replaceWithSpinner();
            await replaceWithDashboard(options.componentProperties.organization, options);
        },
        ...orgInUriParams,
    });
}

// REGISTRATION
if (orgInDomain) {
    defineRoute({
        name: AppRoute.OrgScopedRegistration,
        url: $t('leden'),
        // TODO: move to component pattern (see verify-email)
        handler: async (options) => {
            await replaceWithSpinner();
            await replaceWithRegistration(await orgInDomain(), options);
        },
    });
} else {
    if (STAMHOOFD.userMode === 'platform') {
        const ignoreUris = [$t('berichten'), $t('start'), $t('mandje'), $t('activiteiten')];
        for (const uri of ignoreUris) {
            defineRoute({
                // no name, because we should not really reference these routes
                url: $t('leden') + '/' + uri,
                // TODO: move to component pattern (see verify-email)
                handler: async (options) => {
                    await replaceWithSpinner();
                    await replaceWithRegistration(null, { ...options, url: $t('leden') });
                },
            });
        }
    }
    defineRoute({
        name: AppRoute.OrgScopedRegistration,
        url: $t('leden') + '/@organizationUri',
        // TODO: move to component pattern (see verify-email)
        handler: async (options) => {
            await replaceWithSpinner();
            await replaceWithRegistration(options.componentProperties.organization, options);
        },
        ...orgInUriParams,
    });
    if (STAMHOOFD.userMode === 'platform') {
        defineRoute({
            name: AppRoute.UnscopedRegistration,
            url: $t('leden'),
            // TODO: move to component pattern (see verify-email)
            handler: async (options) => {
                await replaceWithSpinner();
                await replaceWithRegistration(null, options);
            },
        });
    }
}

function parseEmailVerifyQuery(query: URLSearchParams | null | undefined) {
    if (!query?.get('token')) {
        throw new SimpleError({
            code: 'missing_field',
            field: 'token',
            message: 'Token or email missing in query parameters for verify-email route',
            human: $t('Kan je e-mailadres niet verifiëren: ongeldige link'),
        });
    }
    return {
        token: query?.get('token') ?? '',
        email: query?.get('email') ?? null,
        code: query?.get('code') ?? null,
    };
}

function getEmailVerifyQuery(props: ReturnType<typeof parseEmailVerifyQuery>) {
    return props.code
        ? new URLSearchParams([
                ['token', props.token],
                ['email', props.email ?? ''],
                ['code', props.code],
            ])
        : new URLSearchParams([
                ['token', props.token],
                ['email', props.email ?? ''],
            ]);
}

// VERIFY-EMAIL
if (orgInDomain) {
    defineRoute({
        name: AppRoute.VerifyEmail,
        url: $t('verify-email'),
        defaultProperties: parseEmailVerifyQuery,
        propsToParams: props => ({
            query: getEmailVerifyQuery(props),
        }),
        component: async (props) => {
            return await loadVerifyEmail(await orgInDomain(), props);
        },
    });
} else if (STAMHOOFD.userMode === 'platform') {
    defineRoute({
        name: AppRoute.VerifyEmail,
        url: $t('verify-email'),
        defaultProperties: query => ({
            ...parseEmailVerifyQuery(query),
        }),
        propsToParams: props => ({
            query: getEmailVerifyQuery(props),
        }),
        component: async (props) => {
            console.log('Verify email view', props);

            return await loadVerifyEmail(null, props);
        },
    });
} else {
    defineRoute({
        name: AppRoute.VerifyEmail,
        url: 'verify-email/@organizationUri',
        params: { organizationUri: String },
        paramsToProps: async (params, query) => {
            return {
                organization: await paramsToRequiredOrganization(params),
                ...parseEmailVerifyQuery(query),
            };
        },
        propsToParams: props => ({
            params: organizationToParams(props.organization),
            query: getEmailVerifyQuery(props),
        }),
        component: async (props) => {
            console.log('Verify email view', props);
            return await loadVerifyEmail(props.organization, props);
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
