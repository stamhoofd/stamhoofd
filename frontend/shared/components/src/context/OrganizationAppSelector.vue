<template>
    <nav class="st-view organization-app-switcher">
        <STNavigationBar v-if="!popup" :title="$t(`%a4`)" />

        <main>
            <h1 v-if="!popup">
                {{ $t('%4Q') }}
            </h1>

            <template v-if="currentOptions.length">
                <STList>
                    <STListItem v-for="option in currentOptions" :key="option.id" :selectable="true" element-name="button" class="left-center" data-testid="app-switcher-option" :data-app="option.app" :data-organization="option.organization?.id ?? 'null'" @click="selectOption(option)">
                        <template #left>
                            <ContextLogo :organization="option.organization" :app="option.app" />
                        </template>
                        <h1 class="style-title-list" data-testid="app-switcher-option-title">
                            {{ getAppTitle(option.app, option.organization, 'current') }}
                        </h1>
                        <p v-if="getAppDescription(option.app, option.organization, 'current')" class="style-description-small" data-testid="app-switcher-option-description">
                            {{ getAppDescription(option.app, option.organization, 'current') }}
                        </p>
                        <template v-if="isCurrent(option)" #right>
                            <span class="icon success primary floating small" />
                        </template>
                    </STListItem>
                </STList>

                <hr v-if="otherOptions.length">
            </template>

            <STList v-if="otherOptions.length">
                <STListItem v-for="option in otherOptions" :key="option.id" :selectable="true" element-name="button" class="left-center" data-testid="app-switcher-option" :data-app="option.app" :data-organization="option.organization?.id ?? 'null'" @click="selectOption(option)">
                    <template #left>
                        <ContextLogo :organization="option.organization" :app="option.app" />
                    </template>
                    <h1 class="style-title-list" data-testid="app-switcher-option-title">
                        {{ getAppTitle(option.app, option.organization, 'other') }}
                    </h1>
                    <p v-if="getAppDescription(option.app, option.organization, 'other')" class="style-description-small" data-testid="app-switcher-option-description">
                        {{ getAppDescription(option.app, option.organization, 'other') }}
                    </p>
                    <p v-if="option.userDescription" class="style-description-small style-em">
                        {{ $t('%WF') }} {{ option.userDescription }}
                    </p>

                    <template v-if="isCurrent(option)" #right>
                        <span class="icon success primary floating small" />
                    </template>
                </STListItem>

                <STListItem v-if="!STAMHOOFD.singleOrganization" :selectable="true" element-name="button" class="left-center" data-testid="app-switcher-search-others" @click="searchOrganizations">
                    <template #left>
                        <IconContainer icon="search" class="transparent" />
                    </template>

                    <h1 class="style-title-list">
                        {{ $t('%a3') }}
                    </h1>
                </STListItem>
            </STList>

            <template v-else-if="(STAMHOOFD.userMode !== 'platform' || hasAdmin) && !STAMHOOFD.singleOrganization">
                <hr v-if="currentOptions.length || otherOptions.length">
                <button class="button text" type="button" data-testid="app-switcher-search-others" @click="searchOrganizations">
                    <span class="icon search" />
                    <span>{{ $t('%a3') }}</span>
                </button>
            </template>
        </main>
    </nav>
</template>

<script setup lang="ts">
import { usePopup } from '@simonbackx/vue-app-navigation';
import type { Ref } from 'vue';
import { computed, onMounted, shallowRef } from 'vue';

import { AppRoute } from '@stamhoofd/structures';
import { useAppNavigate } from '.././hooks/useAppNavigate';
import { useOrganization } from '../hooks/useOrganization.ts';
import { useAppData } from './appContext';
import ContextLogo from './ContextLogo.vue';
import type { Option } from './hooks/useContextOptions';
import { useContextOptions } from './hooks/useContextOptions';
import IconContainer from '../icons/IconContainer.vue';
import { useUser } from '../hooks/useUser.ts';

const popup = usePopup();
const appNavigate = useAppNavigate();
const user = useUser();

const { getAllOptions, getDefaultOptions, selectOption, isCurrent } = useContextOptions();
const { getAppTitle, getAppDescription } = useAppData();
const options: Ref<Option[]> = shallowRef(getDefaultOptions());
const organization = useOrganization();

onMounted(async () => {
    // Update options when the default options change
    try {
        options.value = await getAllOptions();
    } catch (e) {
        console.error('Failed to load organization options:', e);
    }
});

function isCurrentOption(o: Option) {
    // Current option = logged in with the same user

    return (!organization.value || !o.organization || (organization.value && o.organization?.id === organization.value.id)) && user.value && o.context.user?.id === user.value.id;
}

const currentOptions = computed(() => {
    const list = options.value.filter(o => isCurrentOption(o));
    if (list.length >= 1) {
        return list;
    }
    return [];
});
const otherOptions = computed(() => currentOptions.value.length <= 0 ? options.value : options.value.filter(o => !isCurrentOption(o)));
const hasAdmin = computed(() => {
    return options.value.some(o => o.app === 'admin');
});

const searchOrganizations = async () => {
    await appNavigate(AppRoute.UnscopedAuto);
    throw new Error('Should have been navigated away');
};

</script>

<style lang="scss">
.organization-app-switcher {
    --st-hr-margin: 15px;
    --block-width: 28px;
}
</style>
