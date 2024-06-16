import { SessionContext, SessionManager } from "@stamhoofd/networking";
import { Organization } from "@stamhoofd/structures";

import { PromiseComponent } from "../../containers/AsyncComponent";
import { ReplaceRootEventBus } from "../../overlays/ModalStackEventBus";
import { useOrganization, useUser } from '../../hooks';
import { AppType, useAppContext } from "../appContext";

export type Option = {
    id: string,
    app: AppType|'auto',
    organization: Organization|null,
    context: SessionContext,
    userDescription?: string
}

export function useContextOptions() {
    const $user = useUser();
    const $organization = useOrganization();
    const app = useAppContext();
    
    const getDefaultOptions = async () => {
        const availableContexts = await SessionManager.availableSessions()
        const opts: Option[] = [];

        if ($user.value && $user.value.organizationId === null && $user.value.permissions && $user.value.permissions.globalPermissions !== null) {
            const context = new SessionContext(null)
            await context.loadFromStorage();

            if (context.canGetCompleted()) {
                opts.push({
                    id: 'admin',
                    organization: null,
                    app: 'admin',
                    context
                })
            }
        }

        if (STAMHOOFD.userMode === 'platform') {
            const context = new SessionContext(null)
            await context.loadFromStorage();

            opts.push({
                id: 'registration',
                organization: null,
                app: 'registration',
                context
            })
        }

        for (const context of availableContexts) {
            if (!context.canGetCompleted()) {
                continue;
            }

            // Do we have permissions to manage this organization?
            const organization = context.organization
            if (!organization) {
                continue;
            }

            const user = context.user;

            if (!user || !$organization.value || ($organization.value && organization.id !== $organization.value.id)) {
                opts.push({
                    id: 'org-'+organization.id,
                    organization,
                    app: 'auto',
                    context,
                    userDescription: user && (!$user.value || user.id !== $user.value.id) ? user.email : undefined
                })
                continue;
            }

            // Todo: this needs to be updated
            const hasAccess = context.hasPermissions()
            if (hasAccess) {
                opts.push({
                    id: 'dashboard-'+organization.id,
                    organization,
                    app: 'dashboard',
                    context
                })

                const membersEnabled = organization.meta.packages.useMembers
                if (STAMHOOFD.userMode !== 'platform' && membersEnabled) {
                    opts.push({
                        id: 'registration-'+organization.id,
                        organization,
                        app: 'registration',
                        context
                    })
                }
            } else {
                opts.push({
                    id: 'org-'+organization.id,
                    organization,
                    app: 'auto',
                    context
                })
            }
        }

        return opts;
    }

    const getOptionForOrganization = async (organization: Organization) => {
        const context = new SessionContext(organization)
        await context.loadFromStorage();

        return {
            id: 'org-'+organization.id,
            organization,
            app: 'auto',
            context,
            userDescription: context.user && (!$user.value || context.user.id !== $user.value.id) ? context.user.email : undefined
        }
    }

    const buildRootForOption = async (option: Option) => {
        await SessionManager.prepareSessionForUsage(option.context)

        if (option.app === 'auto') {
            const admin = await import('@stamhoofd/dashboard')
            return await admin.getScopedAutoRoot(option.context)
        }
    
        if (option.app === 'admin') {
            const admin = await import('@stamhoofd/admin-frontend')
            return await admin.getScopedAdminRoot(option.context)
        }
    
        if (option.app === 'dashboard') {
            const dashboard = await import('@stamhoofd/dashboard')
            return await dashboard.getScopedDashboardRoot(option.context)
        }
    
        if (option.app === 'registration') {
            const registration = await import('@stamhoofd/registration')
            return await registration.getRootView(option.context)
        }
        throw new Error('This app is not yet supported')
    }

    const selectOption = (option: Option) => {
        ReplaceRootEventBus.sendEvent("replace", PromiseComponent(async () => {
            return await buildRootForOption(option);
        }))
    }

    const isCurrent = (option: Option) => {
        return ((option.app === app || (option.app === 'auto' && option.organization)) && (option.organization?.id ?? null) === ($organization.value?.id ?? null))
    }

    return {
        getDefaultOptions,
        getOptionForOrganization,
        buildRootForOption,
        selectOption,
        isCurrent
    }
}

