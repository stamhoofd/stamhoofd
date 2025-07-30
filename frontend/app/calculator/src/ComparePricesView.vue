<template>
    <div class="st-view">
        <STNavigationBar title="Vergelijken" />
        <main>
            <h1>
                Vergelijk prijzen met andere platformen
            </h1>

            <STList>
                <STListItem v-for="competitor in competitors" :key="competitor.name" :selectable="true" @click="openCompetitor(competitor)">
                    <h3 class="style-title-list">
                        {{ competitor.name }}
                    </h3>
                    <p v-if="cheapestCompetitor === competitor" class="style-description-small">
                        Goedkoopste optie
                    </p>

                    <p class="style-description-small">
                        {{ competitor.description }}
                    </p>

                    <CalculationGroupDescription
                        v-if="getSummary(competitor)"
                        :calculation="getSummary(competitor)!"
                    />

                    <template #right>
                        <span v-if="getTotalCost(competitor) !== null" class="style-price-base">
                            {{ formatPrice(getTotalCost(competitor)!) }}
                        </span>
                        <span v-else class="style-description-small">
                            Onbeschikbaar
                        </span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { CalculationInput } from './classes/CalculationInput';
import { TariffDefinition } from './classes/TariffDefinition';
import CalculationGroupDescription from './CalculationGroupDescription.vue';
import { CalculationGroup } from './classes/CalculationOutput';
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import CalculationOutputView from './CalculationOutputView.vue';
import { Toast } from '@stamhoofd/components';
import { AllPlatforms } from './classes/tariffs';

const show = useShow();
const props = defineProps<{
    input: CalculationInput;
}>();

const competitors: TariffDefinition[] = AllPlatforms;

const cheapestCompetitor = competitors.reduce((prev, curr) => {
    const prevCost = getTotalCost(prev);
    const currCost = getTotalCost(curr);
    return (prevCost !== null && (currCost === null || prevCost < currCost)) ? prev : curr;
}, competitors[0]);

async function openCompetitor(competitor: TariffDefinition) {
    const input = props.input;
    const output = competitor.calculate(input)?.output;

    if (output) {
        await show({
            components: [
                new ComponentWithProperties(CalculationOutputView, {
                    tariffs: competitor,
                    input: input,
                    output: output,
                }),
            ],
        });
    }
    else {
        Toast.warning('De tarieven zijn onbeschikbaar voor dit platform.').show();
    }
}

function getSummary(competitor: TariffDefinition): CalculationGroup | null {
    try {
        return competitor.calculate(props.input)?.output.getSummary(props.input) ?? null;
    }
    catch (error) {
        return null;
    }
}

function getTotalCost(competitor: TariffDefinition): number | null {
    try {
        return competitor.calculate(props.input)?.output.totalPrice || 0;
    }
    catch (error) {
        return null;
    }
}

</script>
