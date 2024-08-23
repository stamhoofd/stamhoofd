<template>
    <SaveView :title="title" :loading="isLoading" save-text="Stap voltooien" save-icon="success" @save="markReviewed">
        <slot />
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { SetupStepType } from '@stamhoofd/structures';
import { ref } from 'vue';
import { useReview } from './useReview';

const props = defineProps<{title: string, type: SetupStepType}>();
const review = useReview();
const pop = usePop();
const isLoading = ref(false);

async function markReviewed () {
    isLoading.value = true;
    const isSuccess =  await review.markReviewed(props.type);
    if (isSuccess) {
        await pop();
    }
    isLoading.value = false;
}
</script>
