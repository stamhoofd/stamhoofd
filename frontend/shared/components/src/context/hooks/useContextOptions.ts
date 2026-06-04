import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { SessionManager } from '@stamhoofd/networking/SessionManager';
import type { AppType, Organization, User, UserWithMembers } from '@stamhoofd/structures';
import { AppRoute } from '@stamhoofd/structures';

import { useOrganization, usePlatform, useUser } from '../../hooks';
import { useAppNavigate } from '../../hooks/useAppNavigate';
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

    const isPlatformAdmin = (user: User | null) => {
        if (user && user.organizationId === null && user.permissions && user.permissions.globalPermissions !== null) {
            if (user.permissions?.forPlatform(platform.value)?.isEmpty === false) {
                return true;
            }
        }
        return false;
    };

    const hasAdminOption = () => {
        return isPlatformAdmin($user.value);
    };

    const getDefaultOptionsFor = (user: UserWithMembers | null) => {
        const opts: Option[] = [];

        // Platform level users (present on all platforms)
        if (isPlatformAdmin(user)) {
            const context = new SessionContext(null);
            opts.push({
                id: 'admin',
                organization: null,
                app: 'admin',
                context,
                userDescription: STAMHOOFD.userMode === 'organization' && user ? user.email : undefined,
            });
        }

        if (STAMHOOFD.userMode === 'platform') {
            opts.push(getRegistrationOption());
        }

        let organizationIds = [...user?.permissions?.organizationPermissions.keys() ?? []];
        if (STAMHOOFD.singleOrganization) {
            organizationIds = [STAMHOOFD.singleOrganization];
        }

        // Always add membership organization (we'll check permissions in the loop)
        if (platform.value.membershipOrganizationId && !organizationIds.includes(platform.value.membershipOrganizationId)) {
            organizationIds.push(platform.value.membershipOrganizationId);
        }

        for (const organizationId of organizationIds) {
            const organization = user?.members.organizations.find(o => o.id === organizationId) ?? ($organization.value?.id === organizationId ? $organization.value : null);
            if (!organization || user?.permissions?.forOrganization(organization, platform.value)?.isEmpty !== false) {
                continue;
            }
            const context = new SessionContext(organization);

            opts.push({
                id: 'dashboard-' + organization.id,
                organization,
                app: 'dashboard',
                context,
                userDescription: STAMHOOFD.userMode === 'organization' && user ? user.email : undefined,
            });
        }

        return opts;
    };

    const getDefaultOptions = () => {
        return getDefaultOptionsFor($user.value);
    };

    /**
     * Only for organization level platforms, where we need to load extra organizations from storage.
     */
    const getAllOptions = async () => {
        if (STAMHOOFD.userMode === 'platform') {
            return getDefaultOptions();
        }

        const options: Option[] = [];

        // Load platform account explicitly (if available)
        const global = new SessionContext(null);
        await global.loadFromStorage();
        if (global.user && global.canGetCompleted()) {
            const d = getDefaultOptionsFor(global.user);
            for (const defaultOption of d) {
                if (!options.find(o => o.id === defaultOption.id)) {
                    options.push(defaultOption);
                }
            }
        }

        // On organization level platforms, we also list all organizations that have an active token stored
        const manager = await SessionManager.getSessionStorage(true);

        for (const organization of manager.organizations) {
            if (options.length > 20) {
                break;
            }

            if (options.find(o => o.organization?.id === organization.id)) {
                continue; // Already added this organization
            }
            const context = new SessionContext(organization);
            await context.loadFromStorage();
            if (context.canGetCompleted()) {
                options.push(
                    {
                        id: 'org-' + organization.id,
                        organization,
                        app: 'auto',
                        context,
                        userDescription: context.user && STAMHOOFD.userMode === 'organization' ? context.user.email : undefined,
                    },
                );
            }
        }

        // Append recent unauthenticated organizations
        for (const organization of manager.organizations) {
            if (options.length > 20) {
                break;
            }

            if (options.find(o => o.organization?.id === organization.id)) {
                continue; // Already added this organization
            }
            const context = new SessionContext(organization);
            await context.loadFromStorage();
            if (!context.canGetCompleted()) {
                options.push(
                    {
                        id: 'org-' + organization.id,
                        organization,
                        app: 'auto',
                        context,
                    },
                );
            }
        }

        return options;
    };

    const getOptionForOrganization = async (organization: Organization): Promise<Option> => {
        const context = new SessionContext(organization);

        return {
            id: 'org-' + organization.id,
            organization,
            app: 'auto',
            context,
            userDescription: context.user && (!$user.value || context.user.id !== $user.value.id) ? context.user.email : undefined,
        };
    };

    const selectOption = (option: Option) => {
        const appNavigate = useAppNavigate();
        const org = option.organization;

        switch (option.app) {
            case 'admin':
                appNavigate(AppRoute.Admin).catch(console.error);
                break;
            case 'dashboard':
                if (org) {
                    appNavigate(AppRoute.Dashboard, { properties: { organization: org } }).catch(console.error);
                }
                break;
            case 'registration':
                if (org || STAMHOOFD.singleOrganization) {
                    appNavigate(AppRoute.OrgScopedRegistration, { properties: { organization: org } }).catch(console.error);
                } else {
                    appNavigate(AppRoute.UnscopedRegistration).catch(console.error);
                }
                break;
            default: // 'auto'
                if (org) {
                    appNavigate(AppRoute.OrgScopedAuto, { properties: { organization: org } }).catch(console.error);
                } else {
                    appNavigate(AppRoute.UnscopedAuto).catch(console.error);
                }
                break;
        }
    };

    const isCurrent = (option: Option) => {
        return ((option.app === app || (option.app === 'auto' && option.organization)) && (option.organization?.id ?? null) === ($organization.value?.id ?? null));
    };

    return {
        hasAdminOption,
        getDefaultOptions,
        getAllOptions,
        getRegistrationOption,
        getOptionForOrganization,
        selectOption,
        isCurrent,
    };
}
