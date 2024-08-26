<template>
    <template v-if="stepsByPriority.length">
        <hr>
        <h2>Vlagmoment</h2>
        <STList :with-animation="true">
            <SetupStepRow v-for="{step, type} in stepsByPriority" :key="type" :type="type" :step="step" />
        </STList>
    </template>
</template>


<script setup lang="ts">
import { useOrganization, useVisibilityChange } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking';
import { computed, onActivated } from 'vue';
import SetupStepRow from './SetupStepRow.vue';
const organization$ = useOrganization();
const organizationManager = useOrganizationManager();

function getSteps() {
    return organization$.value?.period.setupSteps.getAll() ?? [];
}

const stepsByPriority = computed(() => getSteps().sort((a, b) => b.step.priority - a.step.priority));

onActivated(() => forceUpdateOrganization());
useVisibilityChange(() => forceUpdateOrganization());

function forceUpdateOrganization() {
    organizationManager.value.forceUpdate().catch(console.error)
}
</script>

<style lang="scss" scoped>

</style>
