<template>
    <nav class="st-view">
        <main>
            <STList>
                <STListItem v-for="option in options" :key="option.id" :selectable="true" element-name="button" @click="selectOption(option)" class="left-center">
                    <template #left>
                        <ContextLogo :organization="option.organization" :app="option.app" />
                    </template>
                    <h1 class="style-title-list">
                        {{ getAppTitle(option.app, option.organization) }}
                    </h1>
                    <p class="style-description" v-if="getAppDescription(option.app, option.organization)">{{ getAppDescription(option.app, option.organization) }}</p>
                    <p class="style-description-small style-em" v-if="option.userDescription">Ingelogd als {{ option.userDescription }}</p>
                    <template #right v-if="option.userDescription">
                        <span class="icon gray sync" />
                    </template>
                </STListItem>
            </STList>
        </main>
        <STToolbar>
            <template #left>
                <button class="button text" type="button" @click="searchOrganizations">
                    <span class="icon search" />
                    <span>Andere zoeken</span>
                </button>
            </template>
        </STToolbar>
    </nav>
</template>

<script setup lang="ts">
import { SessionContext, SessionManager } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { Ref, shallowRef } from 'vue';
import { PromiseComponent } from '../containers/AsyncComponent';
import STToolbar from '../navigation/STToolbar.vue';
import { ReplaceRootEventBus } from '../overlays/ModalStackEventBus';
import ContextLogo from './ContextLogo.vue';
import { AppType, getAppDescription, getAppTitle } from './appContext';
import { useOrganization, useUser } from '../VueGlobalHelper';

type Option = {
    id: string,
    app: AppType|'auto',
    organization: Organization|null,
    context: SessionContext,
    userDescription?: string
}

const options: Ref<Option[]> = shallowRef([]);
const $user = useUser();
const $organization = useOrganization();

const getOptions = async () => {
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

    for (const context of availableContexts) {
        if (!context.canGetCompleted()) {
            continue;
        }

        // Do we have permissions to manage this organization?
        const user = context.user;
        const organization = context.organization
        if (!organization) {
            continue;
        }

        if (!user || ($organization.value && organization.id !== $organization.value.id)) {
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
        const hasAccess = !!user.permissions
        if (hasAccess) {
            opts.push({
                id: 'dashboard-'+organization.id,
                organization,
                app: 'dashboard',
                context
            })
        }

        const membersEnabled = organization.meta.packages.useMembers
        if (membersEnabled) {
            opts.push({
                id: 'registration-'+organization.id,
                organization,
                app: 'registration',
                context
            })
        } else if (!hasAccess) {
            opts.push({
                id: 'org-'+organization.id,
                organization,
                app: 'auto',
                context
            })
            continue;
        }
    }

    return opts;
}

getOptions().then((opts) => {
    options.value = opts;
}).catch(console.error);

const buildRootForOption = async (option: Option) => {
    await SessionManager.prepareSessionForUsage(option.context)

    if (option.app === 'admin' || (option.app === 'auto' && !option.organization && !!option.context.user?.permissions?.globalPermissions)) {
        const admin = await import('@stamhoofd/admin-frontend')
        return admin.getScopedAdminRoot(option.context)
    }

    if (option.app === 'dashboard' || (option.app === 'auto' && !!option.context.organizationPermissions)) {
        const dashboard = await import('@stamhoofd/dashboard')
        return dashboard.getScopedDashboardRoot(option.context)
    }

    if (option.app === 'registration' || (option.app === 'auto')) {
        const registration = await import('@stamhoofd/registration')
        return registration.getRootView(option.context)
    }
    throw new Error('This app is not yet supported')
}

const selectOption = (option: Option) => {
    ReplaceRootEventBus.sendEvent("replace", PromiseComponent(async () => {
        return await buildRootForOption(option);
    }))
}

const searchOrganizations = () => {
    ReplaceRootEventBus.sendEvent("replace", PromiseComponent(async () => {
        const dashboard = await import('@stamhoofd/dashboard')
        return dashboard.getOrganizationSelectionRoot();
    }))
}

</script>