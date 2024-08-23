<template>
    <STList v-if="$isDone">
        <STListItem class="left-center right-stack" :selectable="true" element-name="label">
            <template #left>
                <div class="progress-container">
                    <LoadingButton :loading="isSaving">
                        <Checkbox :model-value="$isReviewed" :disabled="isSaving" @click.stop.prevent="markReviewed" />
                    </LoadingButton>
                </div>
            </template>
            <h2 class="style-title-list">
                {{ $t(`setup.${props.type}.review.checkbox`) }}
            </h2>
            <TransitionFade>
                <p v-if="$review" class="style-description-small">
                    Gemarkeerd als nagekeken op {{ Formatter.date($review.date, true) }} door {{ $review.userName }}
                </p>
            </TransitionFade>
        </STListItem>
    </STList>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, TransitionFade } from '@stamhoofd/components';
import { SetupStep, SetupStepType } from '@stamhoofd/structures';
import { Formatter, sleep } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { useReview } from './useReview';

const props = defineProps<{step: SetupStep, type: SetupStepType}>();
const review = useReview();
const pop = usePop();
const isSaving = ref(false);

const $review = computed(() => props.step.review);
const $isReviewed = computed(() => $review.value !== null);
const $isDone = computed(() => props.step.isDone);

async function markReviewed () {
    
    const isReviewed = !$isReviewed.value;

    const isConfirm = isReviewed ? await CenteredMessage.confirm("Ben je zeker dat je deze stap wilt voltooien?", "Voltooi") : 
        await CenteredMessage.confirm("Ben je zeker dat je het voltooien van deze stap ongedaan wil maken?", "Ja");

    if(isConfirm) {
        isSaving.value = true;
        await sleep(2000);
        const isSuccess =  await review.updateReviewedAt({type: props.type, isReviewed});
        if (isSuccess && isReviewed) {
            // await pop();
        }
        isSaving.value = false;
    }
}
</script>
