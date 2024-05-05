<template>
    <nav class="st-view">
        <main>
            <STList>
                <STListItem v-for="option in options" :key="option.id" :selectable="true" element-name="button" @click="selectOption(option)">
                    <template #left>
                        <OrganizationAvatar v-if="option.organization" :organization="option.organization" />
                        <Logo v-else />
                    </template>
                    <h1 class="style-title-list">
                        {{ getAppName(option) }}
                    </h1>
                    <p class="style-description" v-if="getDescription(option)">{{ getDescription(option) }}</p>
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
import { PromiseComponent } from './containers/AsyncComponent';
import STToolbar from './navigation/STToolbar.vue';
import { ReplaceRootEventBus } from './overlays/ModalStackEventBus';
import Logo from './icons/Logo.vue'

type AppType = 'registration'|'dashboard'|'admin'
type Option = {
    id: string,
    app: AppType|'auto',
    organization?: Organization,
    context: Session
}

const options: Ref<Option[]> = shallowRef([]);

const getAppName = (option: Option) => {
    if (option.app === 'auto') {
        if (!option.organization) {
            return 'Onbekend'
        }
        return option.organization.name
    }
    switch (option.app) {
        case 'dashboard': return 'Beheerdersportaal';
        case 'registration': return 'Ledenportaal';
        case 'admin': return 'Administratieportaal'
    }
}
const getDescription = (option: Option) => {
    if (option.app === 'auto') {
        return null;
    }
    if (!option.organization) {
        switch (option.app) {
            case 'registration': return 'Mijn inschrijvingen';
            case 'admin': return 'Portaal voor medewerkers'
        }
        return null
    }
    return option.organization.name
}

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