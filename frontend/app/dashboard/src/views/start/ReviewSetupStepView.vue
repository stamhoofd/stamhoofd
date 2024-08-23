<template>
    <!-- <SaveView :title="title" :loading="isLoading"  @save="markReviewed"> -->

    <div class="st-view">
        <STNavigationBar :title="title" />
        <main class="center">
            <h1 class="style-navigation-title">
                {{ title }}
            </h1>
            <slot name="top" />
            <ReviewCheckbox v-if="step" :step="step" :type="type" />
            <slot />
        </main>
    </div>
    <!-- </SaveView> -->
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { useOrganization } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { SetupStepType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import ReviewCheckbox from './ReviewCheckbox.vue';
import { useReview } from './useReview';

const props = defineProps<{type: SetupStepType}>();
const organization$ = useOrganization();

const step = computed(() => organization$.value?.period.setupSteps.get(props.type));

const $t = useTranslate();
const title = computed(() => $t(`setup.${props.type}.review.title`));

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
