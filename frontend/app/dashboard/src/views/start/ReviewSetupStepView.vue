<template>
    <SaveView :title="title" :loading="review.isSaving.value" :disabled="!review.hasChanges.value" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <slot name="top" />
        <ReviewCheckbox :data="review" />
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
const review = useReview(props.type);
const title = computed(() => $t(`setup.${props.type}.review.title`));
const pop = usePop();

async function save() {
    const isSuccess = await review.save();
    if (isSuccess) {
        await pop();
    }
}
</script>
