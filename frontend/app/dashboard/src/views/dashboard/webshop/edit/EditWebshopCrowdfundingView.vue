<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" class="webshop-view-page" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <CheckboxListItem v-model="enableCrowdfunding" :label="$t('Toon ingezameld bedrag')" />
            <CheckboxListItem v-if="enableCrowdfunding" v-model="enableGoal" :label="$t('Toon doelbedrag')">
                <PriceInputBox v-if="enableGoal" v-model="goalAmount" :validator="errors.validator" :title="$t('Doelbedrag')" :min="0" />
            </CheckboxListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';

import { PrivateWebshop, WebshopCrowdfunding, WebshopMetaData } from '@stamhoofd/structures';

import { computed } from 'vue';
import type { UseEditWebshopProps } from './useEditWebshop';
import { useEditWebshop } from './useEditWebshop';
import STList from '@stamhoofd/components/layout/STList.vue';
import CheckboxListItem from '@stamhoofd/components/inputs/CheckboxListItem.vue';
import PriceInputBox from '@stamhoofd/components/inputs/PriceInputBox.vue';

const props = defineProps<UseEditWebshopProps>();

const { webshop, addPatch, errors, saving, save, hasChanges, shouldNavigateAway, originalWebshop } = useEditWebshop({
    getProps: () => props,
});
const viewTitle = $t('Crowdfunding instellen');

const enableCrowdfunding = computed({
    get: () => webshop.value.meta.crowdfunding !== null,
    set: (enableCrowdfunding: boolean) => {
        if (enableCrowdfunding === (webshop.value.meta.crowdfunding !== null)) {
            return;
        }
        const patch = WebshopMetaData.patch({
            crowdfunding: enableCrowdfunding ? (originalWebshop.meta.crowdfunding ?? WebshopCrowdfunding.create({})) : null,
        });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const enableGoal = computed({
    get: () => webshop.value.meta.crowdfunding?.goalAmount !== null,
    set: (enableGoal: boolean) => {
        const patch = WebshopMetaData.patch({
            crowdfunding: WebshopCrowdfunding.patch({
                goalAmount: enableGoal ? (originalWebshop.meta.crowdfunding?.goalAmount ?? 0) : null,
            }),
        });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const goalAmount = computed({
    get: () => webshop.value.meta.crowdfunding?.goalAmount ?? 0,
    set: (goalAmount: number) => {
        const patch = WebshopMetaData.patch({
            crowdfunding: WebshopCrowdfunding.patch({
                goalAmount: goalAmount,
            }),
        });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

defineExpose({
    shouldNavigateAway,
});
</script>
