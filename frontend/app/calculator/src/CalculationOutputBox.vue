<template>
    <SegmentedControl v-model="calculationMode" :items="availableCalculationModes.map(i => i.id)" :labels="availableCalculationModes.map(i => i.label)" />
    <CalculationGroupBox v-if="output && calculationMode === 'perUnit'" :calculation="output.getSummary(input)" />
    <CalculationGroupBox v-if="output && calculationMode === 'perPerson'" :calculation="output.getPerPerson(input)" />
    <CalculationGroupBox v-if="output && calculationMode === 'total'" :calculation="output.getTotal(input)" />
</template>

<script lang="ts" setup>
import { SegmentedControl } from '@stamhoofd/components';
import { computed, ref, watch } from 'vue';
import CalculationGroupBox from './CalculationGroupBox.vue';
import { CalculationInput } from './classes/CalculationInput';
import { CalculationOutput } from './classes/CalculationOutput';
import { ModuleType } from './classes/ModuleType';

const props = defineProps<{
    input: CalculationInput;
    output: CalculationOutput;
}>();

type CalculationMode = 'perUnit' | 'perPerson' | 'total';
const calculationMode = ref<CalculationMode>('perUnit');

const availableCalculationModes = computed(() => {
    if (props.input.module === ModuleType.Members) {
        if (props.input.persons === props.input.amount) {
            return [
                {
                    // We use perUnit label here, as the result would be the same
                    id: 'perUnit' as CalculationMode,
                    label: 'Per inschrijving',
                },
                {
                    id: 'total' as CalculationMode,
                    label: 'Totaal',
                },
            ];
        }

        return [
            {
                id: 'perUnit' as CalculationMode,
                label: 'Per inschrijving',
            },
            {
                id: 'perPerson' as CalculationMode,
                label: 'Per lid',
            },
            {
                id: 'total' as CalculationMode,
                label: 'Totaal',
            },
        ];
    }
    return [
        {
            id: 'perUnit' as CalculationMode,
            label: 'Per ticket',
        },
        {
            id: 'total' as CalculationMode,
            label: 'Totaal',
        },
    ];
});

watch(availableCalculationModes, (updated) => {
    if (!updated.find(i => i.id === calculationMode.value)) {
        calculationMode.value = updated[0].id;
    }
}, { immediate: true });

</script>
