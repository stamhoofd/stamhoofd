<template>
    <nav class="st-view organization-app-switcher">
        <main>
            <template v-if="currentOptions.length">
                <STList>
                    <STListItem v-for="option in currentOptions" :key="option.id" :selectable="true" element-name="button" @click="selectOption(option)" class="left-center">
                        <template #left>
                            <ContextLogo :organization="option.organization" :app="option.app" />
                        </template>
                        <h1 class="style-title-list">
                            {{ getAppTitle(option.app, option.organization) }}
                        </h1>
                        <p class="style-description" v-if="getAppDescription(option.app, option.organization)">{{ getAppDescription(option.app, option.organization) }}</p>
                        <p class="style-description-small style-em" v-if="option.userDescription">Ingelogd als {{ option.userDescription }}</p>
                        
                        
                        <template #right v-if="isCurrent(option) || option.userDescription || (option.context.hasPermissions() && option.app === 'auto')">
                            <span v-if="isCurrent(option)" class="icon success primary floating" />
                            <span v-else-if="option.userDescription" class="icon gray sync" />
                            <span v-else-if="option.context.hasPermissions() && option.app === 'auto'" class="icon privacy gray floating" />
                        </template>
                    </STListItem>
                </STList>

                <hr v-if="otherOptions.length">
            </template>

            <STList v-if="otherOptions.length">
                <STListItem v-for="option in otherOptions" :key="option.id" :selectable="true" element-name="button" @click="selectOption(option)" class="left-center">
                    <template #left>
                        <ContextLogo :organization="option.organization" :app="option.app" />
                    </template>
                    <h1 class="style-title-list">
                        {{ getAppTitle(option.app, option.organization) }}
                    </h1>
                    <p class="style-description" v-if="getAppDescription(option.app, option.organization)">{{ getAppDescription(option.app, option.organization) }}</p>
                    <p class="style-description-small style-em" v-if="option.userDescription">Ingelogd als {{ option.userDescription }}</p>
                    
                    <template #right v-if="isCurrent(option) || option.userDescription || (option.context.hasPermissions() && option.app === 'auto')">
                        <span v-if="isCurrent(option)" class="icon success primary floating" />
                        <span v-else-if="option.userDescription" class="icon gray sync" />
                        <span v-else-if="option.context.hasPermissions() && option.app === 'auto'" class="icon privacy gray floating" />
                    </template>
                </STListItem>
            </STList>

            <hr>

            <button class="button text" type="button" @click="searchOrganizations">
                <span class="icon search" />
                <span>Andere zoeken</span>
            </button>
        </main>
    </nav>
</template>

<script setup lang="ts">
import { Ref, computed, shallowRef } from 'vue';
import { PromiseComponent } from '../containers/AsyncComponent';
import { ReplaceRootEventBus } from '../overlays/ModalStackEventBus';
import ContextLogo from './ContextLogo.vue';
import { getAppDescription, getAppTitle } from './appContext';
import { Option, useContextOptions } from './hooks/useContextOptions';

const options: Ref<Option[]> = shallowRef([]);

const {getDefaultOptions, selectOption, isCurrent} = useContextOptions()

const currentOptions = computed(() => {
    const list = options.value.filter(o => o.app !== 'auto')
    if (list.length > 1) {
        return list;
    }
    return []
});
const otherOptions = computed(() => currentOptions.value.length <= 0 ? options.value : options.value.filter(o => o.app === 'auto'));

getDefaultOptions().then((opts) => {
    options.value = opts;
}).catch(console.error);

const searchOrganizations = () => {
    ReplaceRootEventBus.sendEvent("replace", PromiseComponent(async () => {
        const dashboard = await import('@stamhoofd/dashboard')
        return dashboard.getOrganizationSelectionRoot();
    }))
}

</script>

<style lang="scss">
.organization-app-switcher {
    --st-hr-margin: 15px;
}
</style>