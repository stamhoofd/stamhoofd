<template>
    <div class="st-view">
        <STNavigationBar title="Vergelijken" />
        <main>
            <h1>
                {{ tariffs.name }}
            </h1>

            <CalculationOutputBox v-if="output" :output="output" :input="input" />

            <p>
                <button type="button" class="button text" @click="showDetails = !showDetails">
                    <span>Gedetailleerde berekening</span>
                    <span v-if="!showDetails" class="icon arrow-down-small" />
                    <span v-else class="icon arrow-up-small" />
                </button>
            </p>

            <DetailedCalculationBox v-if="showDetails && output" :output="output" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import CalculationOutputBox from './CalculationOutputBox.vue';
import { CalculationInput } from './classes/CalculationInput';
import { CalculationGroup, CalculationOutput } from './classes/CalculationOutput';
import { TariffDefinition } from './classes/TariffDefinition';
import DetailedCalculationBox from './DetailedCalculationBox.vue';

const props = defineProps<{
    tariffs: TariffDefinition;
    input: CalculationInput;
    output: CalculationOutput;
}>();

const showDetails = ref(false);
const summary = getSummary(props.tariffs);

function getSummary(competitor: TariffDefinition): CalculationGroup | null {
    try {
        return competitor.calculate(props.input)?.output.getSummary(props.input) ?? null;
    }
    catch (error) {
        return null;
    }
}

</script>
