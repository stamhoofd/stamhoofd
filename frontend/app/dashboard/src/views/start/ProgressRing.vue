<template>
    <svg
        :height="radius * 2"
        :width="radius * 2"
    >
        <circle
            stroke="black"
            opacity="0.1"
            fill="transparent"
            :stroke-width="stroke"
            :r="normalizedRadius"
            :cx="radius"
            :cy="radius"
        />
        <circle
            stroke="var(--color-primary, #0053ff)"
            fill="transparent"
            :stroke-dasharray="circumference + ' ' + circumference"
            :style="{ strokeDashoffset }"
            :stroke-width="stroke"
            :r="normalizedRadius"
            :cx="radius"
            :cy="radius"
        />
    </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{radius: number, progress: number, stroke: number}>();

const normalizedRadius = computed(() => props.radius - props.stroke);
const circumference = computed(() => normalizedRadius.value * 2 * Math.PI);
const strokeDashoffset = computed(() => circumference.value - (props.progress * circumference.value) );
</script>

<style lang="scss" scoped>

circle {
          transition: stroke-dashoffset 0.35s;
          transform: rotate(-90deg);
          transform-origin: 50% 50%;
        }
</style>
