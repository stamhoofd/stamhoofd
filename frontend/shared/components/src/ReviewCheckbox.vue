<template>
    <STList v-if="data.step && props.data.isDone">
        <STListItem class="left-center right-stack" :selectable="true" element-name="label">
            <template #left>
                <div class="progress-container">
                    <Checkbox v-model="value" />
                </div>
            </template>
            <h2 class="style-title-list">
                {{ checkboxTitle }}
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
import { TransitionFade, useSetupStepTranslations } from '@stamhoofd/components';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { ReviewCheckboxData } from './useReview';

const props = defineProps<{data: ReviewCheckboxData}>();
const $review = computed(() => props.data.step?.review);
const setupStepTranslations = useSetupStepTranslations();

const checkboxTitle = computed(() => setupStepTranslations.getReviewCheckboxTitle(props.data.type));

const value = computed({
    get: () => props.data.checkboxValue,
    set: value => props.data.setValue(value)
})
</script>
