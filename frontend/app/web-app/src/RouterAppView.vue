<template>
    <LoadingView />
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, defineRoute, UrlHelper, useNavigate } from '@simonbackx/vue-app-navigation';
import LoadingView from '@stamhoofd/components/containers/LoadingView.vue';
import { provideAppNavigate } from '@stamhoofd/components/hooks/useAppNavigate';
import { AppManager } from '@stamhoofd/networking/AppManager';
import type { Organization } from '@stamhoofd/structures';
import { AppRoute } from '@stamhoofd/structures';
import type { Language } from '@stamhoofd/types/Language';
import { Formatter } from '@stamhoofd/utility';
import { domainToOrganization, idToOrganization, uriToOrganization } from './organizationLoaders';
import { wrap } from './wrapAndReplace';
import { buildTranslatedUrl, extendTranslatedUrl, getUrls } from '@stamhoofd/components/containers/TranslatedUrl.ts';

provideAppNavigate(useNavigate());

const isDashboardDomain = AppManager.shared.isOnDashboardDomain;

async function paramsToRequiredOrganization<T extends { organizationUri: string }>(params: T) {
    const org = await uriToOrganization(params.organizationUri);
    if (!org) {
        throw new SimpleError({
            code: 'invalid_field',
            field: 'organizationUrl',
            message: 'No organization found for the given URI, but required for this route',
            human: $t('%1ck', { uri: params.organizationUri }),
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

async function loadAdmin() {
    const admin = await import('@stamhoofd/admin-frontend');
    return await wrap(null, 'admin', new ComponentWithProperties(admin.App, {}));
}

async function loadDashboard(organization: Organization) {
    const dashboard = await import('@stamhoofd/dashboard');
    return await wrap(organization, 'dashboard', new ComponentWithProperties(dashboard.App, {}));
}

async function loadRegistration(organization: Organization | null) {
    const registration = await import('@stamhoofd/registration');
    return await wrap(organization, 'registration', new ComponentWithProperties(registration.App, {}));
}

async function loadAuto(organization: Organization | null) {
    const auto = await import('@stamhoofd/auto');
    return await wrap(organization, 'auto', new ComponentWithProperties(auto.App, {}));
}

async function loadVerifyEmail(organization: Organization | null, componentProperties: { token: string; email: string | null; code: string | null }) {
    const auth = await import('@stamhoofd/verify-email');
    return await wrap(organization, 'verify-email', new ComponentWithProperties(auth.App, componentProperties));
}

// ADMIN
if (isDashboardDomain) {
    defineRoute({
        name: AppRoute.Admin,
        url: 'platform',
        component: async () => {
            return await loadAdmin();
        },
    });
}

// DASHBOARD
const DashboardUrl = buildTranslatedUrl({
    nl: 'beheerders',
    en: 'dashboard',
    fr: 'dashboard',
});

if (orgInDomain) {
    defineRoute({
        name: AppRoute.Dashboard,
        ...getUrls(DashboardUrl),
        component: async () => {
            return await loadDashboard(await orgInDomain());
        },
    });
} else {
    defineRoute<{ organizationUri: StringConstructor }, { organization: Organization }>({
        name: AppRoute.Dashboard,
        ...getUrls(extendTranslatedUrl(DashboardUrl, '@organizationUri')),
        component: async (props) => {
            return await loadDashboard(props.organization);
        },
        ...orgInUriParams,
    });
}

// REGISTRATION
const RegistrationsUrl = buildTranslatedUrl({
    nl: 'leden',
    en: 'members',
    fr: 'membres',
});

if (orgInDomain) {
    defineRoute({
        name: AppRoute.OrgScopedRegistration,
        force: true,
        replace: 100,
        ...getUrls(RegistrationsUrl),
        component: async () => {
            return await loadRegistration(await orgInDomain());
        },
    });
} else {
    const ignoreUris = [
        buildTranslatedUrl({ nl: 'berichten', fr: 'messages', en: 'messages' }),
        buildTranslatedUrl({ nl: 'start', fr: 'debut', en: 'start' }),
        buildTranslatedUrl({ nl: 'mandje', fr: 'panier', en: 'basket' }),
        buildTranslatedUrl({ nl: 'activiteiten', fr: 'activites', en: 'activities' }),
        'reset-password',
    ];

    defineRoute<{ organizationUri: StringConstructor }, { organization: Organization }>({
        name: AppRoute.OrgScopedRegistration,
        ...getUrls(extendTranslatedUrl(RegistrationsUrl, '@organizationUri')),
        ignoreUrls: Formatter.uniqueArray(ignoreUris.flatMap((uri) => {
            return Object.values(extendTranslatedUrl(RegistrationsUrl, uri));
        })),
        force: true,
        replace: 100,
        component: async (props) => {
            return await loadRegistration(props.organization);
        },
        ...orgInUriParams,
    });
    if (STAMHOOFD.userMode === 'platform') {
        defineRoute({
            name: AppRoute.UnscopedRegistration,
            ...getUrls(RegistrationsUrl),
            force: true,
            replace: 100,
            component: async () => {
                return await loadRegistration(null);
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
            human: $t('%1Ub'),
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
        url: 'verify-email',
        force: true,
        replace: 100,
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
        url: 'verify-email',
        force: true,
        replace: 100,
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
        force: true,
        replace: 100,
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
            return await loadAuto(await orgInDomain());
        },
    });
} else {
    defineRoute<{ organizationUri: StringConstructor }, { organization: Organization }>({
        name: AppRoute.OrgScopedAuto,
        url: 'auto/@organizationUri',
        force: true,
        replace: 100,
        component: async (properties) => {
            return await loadAuto(properties.organization);
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
            return await loadAuto(null);
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
