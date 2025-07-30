<template>
    <ul v-if="line.remarks && line.remarks.length">
        <CalculationRemarkBox v-for="(remark, index) in line.remarks" :key="index" :remark="remark" />
    </ul>
</template>

<script lang="ts" setup>
import { CalculationLine } from './classes/CalculationOutput';
import CalculationRemarkBox from './CalculationRemarkBox.vue';

defineProps<{
    line: CalculationLine;
}>();
</script>
