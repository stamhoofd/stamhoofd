<template>
    <SaveView :title="title" save-text="Stap voltooien" save-icon="success" @save="markReviewed">
        <slot/>
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { SetupStepType } from '@stamhoofd/structures';
import { useReview } from './useReview';

const props = defineProps<{title: string, type: SetupStepType}>();
const review = useReview();
const pop = usePop();

async function markReviewed () {
    const isSuccess =  await review.markReviewed(props.type);
    if(isSuccess) {
        await pop();
    }
}
</script>
