import { SessionContext, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';

import { useTranslate } from '@stamhoofd/frontend-i18n';
import { PromiseComponent } from '../../containers/AsyncComponent';
import { useOrganization, usePlatform, useUser } from '../../hooks';
import { ReplaceRootEventBus } from '../../overlays/ModalStackEventBus';
import { AppType, useAppContext } from '../appContext';

export type Option = {
    id: string;
    app: AppType | 'auto';
    organization: Organization | null;
    context: SessionContext;
    userDescription?: string;
};

export function appToUri(app: AppType | 'auto') {
    switch (app) {
        case 'admin':
            return $t(`3a18ce8e-5ec6-48b1-a442-906db662c58f`);
        case 'dashboard':
            return $t(`0a7ea16d-50ba-47a4-9dbd-7456de59fd95`);
        case 'registration':
            return $t(`39c566d6-520d-4048-bb1a-53eeea3ccea7`);
        case 'auto':
            return $t(`15a87f5b-ae73-4c45-bc46-5575e95af13e`);
    }
}

export function uriToApp(uri: string) {
    switch (uri) {
        case 'administratie':
            return 'admin';
        case 'beheerders':
            return 'dashboard';
        case 'leden':
            return 'registration';
        default:
            return 'auto';
    }
}

export function useContextOptions() {
    const $user = useUser();
    const $organization = useOrganization();
    const app = useAppContext();
    const $t = useTranslate();
    const platform = usePlatform();

    const getRegistrationOption = (): Option => {
        const context = new SessionContext(null);

        return {
            id: 'registration',
            organization: null,
            app: 'registration',
            context,
        };
    };

    const getDefaultOptions = () => {
        const opts: Option[] = [];

        if ($user.value && $user.value.organizationId === null && $user.value.permissions && $user.value.permissions.globalPermissions !== null) {
            if ($user.value.permissions?.forPlatform(platform.value)?.isEmpty === false) {
                const context = new SessionContext(null);
                // await context.loadFromStorage();

                opts.push({
                    id: 'admin',
                    organization: null,
                    app: 'admin',
                    context,
                });
            }
        }

        if (STAMHOOFD.userMode === 'platform') {
            opts.push(getRegistrationOption());
        }

        const organizationIds = [...$user.value?.permissions?.organizationPermissions.keys() ?? []];
        if (STAMHOOFD.singleOrganization) {
            organizationIds.push(STAMHOOFD.singleOrganization);
        }

        for (const organizationId of organizationIds) {
            const organization = $user.value!.members.organizations.find(o => o.id === organizationId) ?? ($organization.value?.id === organizationId ? $organization.value : null);
            if (!organization || $user.value?.permissions?.forOrganization(organization, platform.value)?.isEmpty !== false) {
                continue;
            }
            const context = new SessionContext(organization);

            opts.push({
                id: 'dashboard-' + organization.id,
                organization,
                app: 'dashboard',
                context,
            });
        }

        return opts;
    };

    const getOptionForOrganization = async (organization: Organization) => {
        const context = new SessionContext(organization);

        return {
            id: 'org-' + organization.id,
            organization,
            app: 'auto',
            context,
            userDescription: context.user && (!$user.value || context.user.id !== $user.value.id) ? context.user.email : undefined,
        };
    };

    const buildRootForOption = async (option: Option) => {
        await option.context.loadFromStorage();
        await SessionManager.prepareSessionForUsage(option.context);

        if (option.app === 'auto') {
            const admin = await import('@stamhoofd/dashboard');
            return await admin.getScopedAutoRoot(option.context);
        }

        if (option.app === 'admin') {
            const admin = await import('@stamhoofd/admin-frontend');
            return await admin.getScopedAdminRoot(option.context, $t);
        }

        if (option.app === 'dashboard') {
            const dashboard = await import('@stamhoofd/dashboard');
            return await dashboard.getScopedDashboardRoot(option.context);
        }

        if (option.app === 'registration') {
            const registration = await import('@stamhoofd/registration');
            return await registration.getRootView(option.context);
        }
        throw new Error('This app is not yet supported');
    };

    const selectOption = (option: Option) => {
        // Try to maintain the same URL for the new scope, to improve switching behaviour per tab
        let href = window.location.href;
        let oldPrefix = '';
        if ($organization.value) {
            oldPrefix = '/' + appToUri(app) + '/' + $organization.value.uri;
        }
        else {
            oldPrefix = '/' + appToUri(app);
        }
        let newPrefix = '';
        if (option.organization) {
            newPrefix = '/' + appToUri(option.app) + '/' + option.organization.uri;
        }
        else {
            newPrefix = '/' + appToUri(option.app);
        }
        console.log(href, oldPrefix, newPrefix);
        if (oldPrefix) {
            href = href.replace(oldPrefix, newPrefix);
        }
        UrlHelper.shared = new UrlHelper(href);

        ReplaceRootEventBus.sendEvent('replace', PromiseComponent(async () => {
            return await buildRootForOption(option);
        })).catch(console.error);
    };

    const isCurrent = (option: Option) => {
        return ((option.app === app || (option.app === 'auto' && option.organization)) && (option.organization?.id ?? null) === ($organization.value?.id ?? null));
    };

    return {
        getDefaultOptions,
        getRegistrationOption,
        getOptionForOrganization,
        buildRootForOption,
        selectOption,
        isCurrent,
    };
}
