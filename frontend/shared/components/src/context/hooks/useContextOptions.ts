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

        for (const organizationId of $user.value?.permissions?.organizationPermissions.keys() ?? []) {
            const organization = $user.value!.members.organizations.find(o => o.id === organizationId) ?? ($organization.value?.id === organizationId ? $organization.value : null)
            if (!organization) {
                continue;
            }
            const context = new SessionContext(organization)
            await context.loadFromStorage();

            opts.push({
                id: 'dashboard-'+organization.id,
                organization,
                app: 'dashboard',
                context
            })
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
        })).catch(console.error)
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

