<template>
    <nav class="st-view organization-app-switcher">
        <STNavigationBar v-if="!popup" :title="$t(`bac747ea-0977-40c5-9b42-382055a0ee84`)" />

        <main>
            <h1 v-if="!popup">
                {{ $t('34aff020-6017-4c23-85b1-44a692988ee6') }}
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
                            {{ $t('c5d8db0b-e901-436d-b292-5dbd6b1df48e', {user: option.userDescription}) }}
                        </p>

                        <template v-if="isCurrent(option) || option.userDescription || (option.context.hasPermissions() && option.app === 'auto')" #right>
                            <span v-if="isCurrent(option)" class="icon success primary floating" />
                            <span v-else-if="option.userDescription" class="icon gray sync" />
                            <span v-else-if="option.context.hasPermissions() && option.app === 'auto'" class="icon privacy gray floating" />
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
                        {{ $t('2dfdd151-6245-4f46-ba42-695a09b74607') }} {{ option.userDescription }}
                    </p>

                    <template v-if="isCurrent(option) || option.userDescription || (option.context.hasPermissions() && option.app === 'auto')" #right>
                        <span v-if="isCurrent(option)" class="icon success primary floating" />
                        <span v-else-if="option.userDescription" class="icon gray sync" />
                        <span v-else-if="option.context.hasPermissions() && option.app === 'auto'" class="icon privacy gray floating" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="(STAMHOOFD.userMode !== 'platform' || hasAdmin) && !STAMHOOFD.singleOrganization">
                <hr v-if="currentOptions.length || otherOptions.length"><button class="button text" type="button" @click="searchOrganizations">
                    <span class="icon search" />
                    <span>{{ $t('e068b5a6-18f2-4801-a518-5903b22b3c04') }}</span>
                </button>
            </template>
        </main>
    </nav>
</template>

<script setup lang="ts">
import { usePopup } from '@simonbackx/vue-app-navigation';
import { computed, Ref, shallowRef } from 'vue';

import { SessionManager } from '@stamhoofd/networking';
import { PromiseComponent } from '../containers/AsyncComponent';
import { ReplaceRootEventBus } from '../overlays/ModalStackEventBus';
import { useAppData } from './appContext';
import ContextLogo from './ContextLogo.vue';
import { Option, useContextOptions } from './hooks/useContextOptions';

const popup = usePopup();

const { getDefaultOptions, selectOption, isCurrent } = useContextOptions();
const { getAppTitle, getAppDescription } = useAppData();
const options: Ref<Option[]> = shallowRef(getDefaultOptions());

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
