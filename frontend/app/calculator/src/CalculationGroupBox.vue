<template>
    <article class="calculation-box">
        <STList>
            <STListItem v-for="(line, index) in lines" :key="index">
                <h3 class="style-title-list">
                    {{ line.title }}
                </h3>
                <p class="style-description-small">
                    {{ line.description }}
                </p>
                <p v-if="line.calculationDescription" class="style-description-small">
                    {{ line.calculationDescription }}
                </p>

                <template #right>
                    <span class="style-price-base">
                        {{ formatPrice(line.totalPrice) }}
                    </span>
                </template>
            </STListItem>

            <STListItem>
                <h3 class="style-title-list larger">
                    {{ calculation.title }}
                </h3>

                <p class="style-description-small">
                    {{ calculation.description }}
                </p>

                <template #right>
                    <span class="style-price-base large">
                        {{ formatPrice(calculation.totalPrice) }}
                    </span>
                </template>
            </STListItem>
        </STList>
    </article>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { CalculationGroup } from './classes/CalculationOutput';

const props = defineProps<{
    calculation: CalculationGroup;
}>();

const lines = computed(() => {
    return props.calculation.lines.filter(line => line.totalPrice !== 0);
});

</script>
