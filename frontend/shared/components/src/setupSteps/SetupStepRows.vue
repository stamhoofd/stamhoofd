<template>
    <STList :with-animation="false">
        <SetupStepRow
            v-for="{ step, type } in $stepsByPriority" :key="type" :setup-step-type="type" :step="step"
            :list-type="listType"
            @click="emits('select', type)"
        />
    </STList>
</template>

<script lang="ts" setup>
import { SetupSteps, SetupStepType } from '@stamhoofd/structures';
import { computed } from 'vue';
import SetupStepRow from './SetupStepRow.vue';

const props = defineProps<{ steps: SetupSteps, listType: 'review' | 'todo' }>();
const emits = defineEmits<{(e: 'select', setupStepType: SetupStepType): void}>();

const $steps = computed(() => props.steps.getAll() ?? []);
const $stepsByPriority = computed(() => [...$steps.value].sort((a, b) => b.step.priority - a.step.priority));
</script>
