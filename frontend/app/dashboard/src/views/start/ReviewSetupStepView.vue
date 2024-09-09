<template>
    <SaveView :title="title" :loading="$isSaving" :disabled="!$hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>
        <slot name="top" />
        <ReviewCheckbox :data="$reviewCheckboxData" />
        <slot />
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { ReviewCheckbox, useOrganization, useReview, useSetupStepTranslations } from '@stamhoofd/components';
import { SetupStepType } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{type: SetupStepType}>();

const setupStepTranslations = useSetupStepTranslations();

const { $isSaving, $hasChanges, $reviewCheckboxData, save: saveReview } = useReview(props.type);

const organization = useOrganization();
const step = computed(() => organization.value?.period.setupSteps.get(props.type));
const isDone = computed(() => step.value?.isDone);

const title = computed(() => isDone.value ? setupStepTranslations.getReviewTitle(props.type) : setupStepTranslations.getTodoTitle(props.type));
const pop = usePop();

async function save() {
    const isSuccess = await saveReview();
    if (isSuccess) {
        await pop();
    }
}
</script>
