<template>
    <svg
        :height="radius * 2"
        :width="radius * 2"
        :style="`border-width: ${borderWidth}px`"
    >
        <circle
            stroke="var(--color-gray-2, red)"
            fill="transparent"
            :stroke-width="stroke"
            :r="normalizedRadius"
            :cx="radius"
            :cy="radius"
        />
        <circle
            stroke="var(--color-primary, red)"
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

const props = withDefaults(defineProps<{radius: number, progress: number, stroke: number, borderWidth?: number}>(), {
    borderWidth: 0
});

const normalizedRadius = computed(() => props.radius - props.stroke);
const circumference = computed(() => normalizedRadius.value * 2 * Math.PI);
const strokeDashoffset = computed(() => circumference.value - (props.progress * circumference.value) );
</script>

<style lang="scss" scoped>

svg {
    border: 0px solid transparent;
}

circle {
    transition: stroke-dashoffset 0.35s;
    transform: rotate(-90deg);
    transform-origin: 50% 50%;
    stroke-linecap: round;
}
</style>
