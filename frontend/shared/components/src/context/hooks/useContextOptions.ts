import { SessionContext, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { appToUri, AppType, Organization } from '@stamhoofd/structures';

import { PromiseComponent } from '../../containers/AsyncComponent';
import { useOrganization, usePlatform, useUser } from '../../hooks';
import { ReplaceRootEventBus } from '../../overlays/ModalStackEventBus';
import { useAppContext } from '../appContext';

export type Option = {
    id: string;
    app: AppType | 'auto';
    organization: Organization | null;
    context: SessionContext;
    userDescription?: string;
};

export function useContextOptions() {
    const $user = useUser();
    const $organization = useOrganization();
    const app = useAppContext();

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

        let organizationIds = [...$user.value?.permissions?.organizationPermissions.keys() ?? []];
        if (STAMHOOFD.singleOrganization) {
            organizationIds = [STAMHOOFD.singleOrganization];
        }

        // Always add membership organization (we'll check permissions in the loop)
        if (platform.value.membershipOrganizationId) {
            organizationIds.push(platform.value.membershipOrganizationId);
        }

        for (const organizationId of organizationIds) {
            const organization = $user.value?.members.organizations.find(o => o.id === organizationId) ?? ($organization.value?.id === organizationId ? $organization.value : null);
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
