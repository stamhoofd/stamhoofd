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
import { ReviewCheckbox, useReview } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { SetupStepType } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{type: SetupStepType}>();

const $t = useTranslate();
const { $isSaving, $hasChanges, $reviewCheckboxData, save: saveReview } = useReview(props.type);
const title = computed(() => $t(`setup.${props.type}.review.title`));
const pop = usePop();

async function save() {
    const isSuccess = await saveReview();
    if (isSuccess) {
        await pop();
    }
}
</script>
