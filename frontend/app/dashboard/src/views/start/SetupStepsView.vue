<template>
    <template v-if="stepsByPriority.length">
        <hr>
        <h2>Breng Ravot in orde</h2>
        <p>Overloop alle stappen en bevestig dat je alles hebt nagekeken bij elke stap. Zorg dat alles ten laatste tegen 15 oktober is nagekeken.</p>

        <STList :with-animation="true">
            <SetupStepRow v-for="{step, type} in stepsByPriority" :key="type" :type="type" :step="step" :save-handler="saveHandler" />
        </STList>
    </template>
</template>


<script setup lang="ts">
import { useOrganization } from '@stamhoofd/components';
import { SetupStepType } from '@stamhoofd/structures';
import { computed } from 'vue';
import SetupStepRow from './SetupStepRow.vue';
import { useReview } from './useReview';

const review = useReview();
const organization$ = useOrganization();

function getSteps() {
    return organization$.value?.period.setupSteps.getAll() ?? [];
}

const stepsByPriority = computed(() => getSteps().sort((a, b) => b.step.priority - a.step.priority));

const saveHandler = async (body: {type: SetupStepType, isReviewed: boolean}) => {
    await review.updateReviewedAt(body)
};
</script>

<style lang="scss" scoped>

</style>
