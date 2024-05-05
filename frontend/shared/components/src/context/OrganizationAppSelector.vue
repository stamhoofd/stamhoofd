<template>
    <nav class="st-view">
        <main>
            <STList>
                <STListItem v-for="option in options" :key="option.id" :selectable="true" element-name="button" @click="selectOption(option)">
                    <template #left>
                        <ContextLogo :organization="option.organization" :app="option.app" />
                    </template>
                    <h1 class="style-title-list">
                        {{ getAppTitle(option.app, option.organization) }}
                    </h1>
                    <p class="style-description" v-if="getAppDescription(option.app, option.organization)">{{ getAppDescription(option.app, option.organization) }}</p>
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
import { Session, SessionManager } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { Ref, shallowRef } from 'vue';
import OrganizationAvatar from './OrganizationAvatar.vue';
import { PromiseComponent } from '../containers/AsyncComponent';
import STToolbar from '../navigation/STToolbar.vue';
import { ReplaceRootEventBus } from '../overlays/ModalStackEventBus';
import Logo from '../icons/Logo.vue'
import { AppType, getAppTitle, getAppDescription } from './appContext';
import ContextLogo from './ContextLogo.vue';

type Option = {
    id: string,
    app: AppType|'auto',
    organization?: Organization,
    context: Session
}

const options: Ref<Option[]> = shallowRef([]);

const getOptions = async () => {
    const availableContexts = await SessionManager.availableSessions()
    const opts: Option[] = [];

    for (const context of availableContexts) {
        // Do we have permissions to manage this organization?
        const user = context.user;
        const organization = context.organization
        if (!organization) {
            continue;
        }

        if (!user) {
            opts.push({
                id: 'org-'+organization.id,
                organization,
                app: 'auto',
                context
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
    if (option.app === 'registration') {
        const registration = await import('@stamhoofd/registration')
        return registration.getRootView(option.context)
    }

    if (option.app === 'dashboard' || option.app == 'auto') {
        const dashboard = await import('@stamhoofd/dashboard')
        return dashboard.getScopedDashboardRoot(option.context)
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