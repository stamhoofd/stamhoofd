<template>
    <p v-for="(line, index) in lines" :key="index" class="style-description-small">
        {{ line.title }}: {{ formatPrice(line.totalPrice) }}
    </p>

    <p class="style-description">
        {{ calculation.title }}: {{ formatPrice(calculation.totalPrice) }}
    </p>
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
