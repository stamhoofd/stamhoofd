<template>
    <nav class="st-view organization-app-switcher">
        <STNavigationBar v-if="!popup" :title="$t(`%a4`)" />

        <main>
            <h1 v-if="!popup">
                {{ $t('%4Q') }}
            </h1>

            <template v-if="currentOptions.length">
                <STList>
                    <STListItem v-for="option in currentOptions" :key="option.id" :selectable="true" element-name="button" class="left-center" @click="selectOption(option)">
                        <template #left>
                            <ContextLogo :organization="option.organization" :app="option.app" />
                        </template>
                        <h1 class="style-title-list">
                            {{ getAppTitle(option.app, option.organization) }}
                        </h1>
                        <p v-if="getAppDescription(option.app, option.organization)" class="style-description">
                            {{ getAppDescription(option.app, option.organization) }}
                        </p>
                        <p v-if="option.userDescription" class="style-description-small style-em">
                            {{ $t('%a2', {user: option.userDescription}) }}
                        </p>

                        <template v-if="isCurrent(option)" #right>
                            <span class="icon success primary floating" />
                        </template>
                    </STListItem>
                </STList>

                <hr v-if="otherOptions.length">
            </template>

            <STList v-if="otherOptions.length">
                <STListItem v-for="option in otherOptions" :key="option.id" :selectable="true" element-name="button" class="left-center" @click="selectOption(option)">
                    <template #left>
                        <ContextLogo :organization="option.organization" :app="option.app" />
                    </template>
                    <h1 class="style-title-list">
                        {{ getAppTitle(option.app, option.organization) }}
                    </h1>
                    <p v-if="getAppDescription(option.app, option.organization)" class="style-description">
                        {{ getAppDescription(option.app, option.organization) }}
                    </p>
                    <p v-if="option.userDescription" class="style-description-small style-em">
                        {{ $t('%WF') }} {{ option.userDescription }}
                    </p>

                    <template v-if="isCurrent(option)" #right>
                        <span class="icon success primary floating" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="(STAMHOOFD.userMode !== 'platform' || hasAdmin) && !STAMHOOFD.singleOrganization">
                <hr v-if="currentOptions.length || otherOptions.length"><button class="button text" type="button" @click="searchOrganizations">
                    <span class="icon search" />
                    <span>{{ $t('%a3') }}</span>
                </button>
            </template>
        </main>
    </nav>
</template>

<script setup lang="ts">
import { usePopup } from '@simonbackx/vue-app-navigation';
import { computed, onMounted, Ref, shallowRef } from 'vue';

import { SessionManager } from '@stamhoofd/networking/SessionManager';
import { PromiseComponent } from '../containers/AsyncComponent';
import { ReplaceRootEventBus } from '../overlays/ModalStackEventBus';
import { useAppData } from './appContext';
import ContextLogo from './ContextLogo.vue';
import { Option, useContextOptions } from './hooks/useContextOptions';

const popup = usePopup();

const { getAllOptions, getDefaultOptions, selectOption, isCurrent } = useContextOptions();
const { getAppTitle, getAppDescription } = useAppData();
const options: Ref<Option[]> = shallowRef(getDefaultOptions());

onMounted(async () => {
    // Update options when the default options change
    try {
        options.value = await getAllOptions();
    }
    catch (e) {
        console.error('Failed to load organization options:', e);
    }
});

const currentOptions = computed(() => {
    const list = options.value.filter(o => o.app !== 'auto');
    if (list.length > 1) {
        return list;
    }
    return [];
});
const otherOptions = computed(() => currentOptions.value.length <= 0 ? options.value : options.value.filter(o => o.app === 'auto'));
const hasAdmin = computed(() => {
    return options.value.some(o => o.app === 'admin');
});

const searchOrganizations = async () => {
    await ReplaceRootEventBus.sendEvent('replace', PromiseComponent(async () => {
        const dashboard = await import('@stamhoofd/dashboard');
        return dashboard.getOrganizationSelectionRoot(await SessionManager.getLastGlobalSession());
    }));
};

</script>

<style lang="scss">
.organization-app-switcher {
    --st-hr-margin: 15px;
}
</style>
