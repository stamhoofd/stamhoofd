<template>
    <STList v-if="data.step && props.data.isDone.value">
        <STListItem class="left-center right-stack" :selectable="true" element-name="label">
            <template #left>
                <div class="progress-container">
                    <Checkbox v-model="value" />
                </div>
            </template>
            <h2 class="style-title-list">
                {{ $t(`setup.${props.data.type}.review.checkboxTitle`) }}
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
import { TransitionFade } from '@stamhoofd/components';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { UseReview } from './useReview';

const props = defineProps<{data: UseReview}>();
const $review = computed(() => props.data.step.value?.review);

const value = computed({
    get: () => props.data.checkboxValue.value,
    set: value => props.data.setValue(value)
})
</script>
