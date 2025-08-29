<template>
    <svg
        ref="svg"
        :height="radius * 2"
        :width="radius * 2"
        :style="`border-width: ${borderWidth}px; --circle-circumference: ${circumference.toFixed(4)}px; opacity: ${opacity.toFixed(2)};`"
        :class="cachedLoading ? 'spinner' : ''"
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
            ref="circle"
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
import { computed, ref, useTemplateRef, watch } from 'vue';

const props = withDefaults(defineProps<{
    radius: number;
    progress?: number;
    stroke: number;
    borderWidth?: number;
    loading?: boolean;
    opacity?: number;
}>(), {
    borderWidth: 0,
    loading: false,
    opacity: 1,
    progress: 0,
});

const templateCircle = useTemplateRef('circle');
const templateEl = useTemplateRef('svg');
const normalizedRadius = computed(() => props.radius - props.stroke);
const circumference = computed(() => normalizedRadius.value * 2 * Math.PI);
const strokeDashoffset = computed(() => {
    if (cachedLoading.value) {
        return lockedDashoffset.value;
    }
    return circumference.value - (props.progress * circumference.value);
});
const cachedLoading = ref(props.loading);
const lockedDashoffset = ref<string | undefined>(undefined);

// Watch loading and if loading starts or ends, smoothly transition to the normal progress state by first setting transform and strokeDashoffset to the current values, then updating loading after a tick
watch(() => props.loading, (newLoading) => {
    if (newLoading === cachedLoading.value) {
        return;
    }
    if (newLoading) {
        // todo: not supported atm

        const svg = templateEl.value as HTMLElement | null;
        if (svg) {
            const circle = templateCircle.value as HTMLElement | null;
            if (circle) {
                const transform = 'transform: rotate(0deg)';
                const strokeDashoffset = 'calc(var(--circle-circumference, 30px) * 0.9)';

                lockedDashoffset.value = strokeDashoffset;
                cachedLoading.value = newLoading;
                svg.style.transform = transform;

                // Don't start the animation yet
                circle.style.animation = 'none';
                svg.style.animation = 'opacity 0.35s 0.35s';

                // Force a reflow so the browser picks up the starting position before animating
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                svg.offsetHeight; // trigger reflow
                setTimeout(() => {
                    circle.style.animation = '';
                    svg.style.animation = '';
                    svg.style.transform = '';

                    lockedDashoffset.value = undefined;
                    cachedLoading.value = newLoading;
                }, 400);
                return;
            }
        }
        cachedLoading.value = newLoading;
        lockedDashoffset.value = undefined;

        return;
    }
    const svg = templateEl.value as HTMLElement | null;
    if (svg) {
        const circle = templateCircle.value as HTMLElement | null;
        if (circle) {
            const svgComputedStyle = getComputedStyle(svg);
            const computedStyle = getComputedStyle(circle);
            const transform = svgComputedStyle.transform;
            const strokeDashoffset = computedStyle.strokeDashoffset;

            circle.style.transition = 'stroke 0.35s';
            circle.style.strokeDashoffset = strokeDashoffset;
            circle.style.animation = 'none';

            svg.style.transition = 'opacity 0.35s 0.35s';
            svg.style.transform = transform;
            svg.style.animation = 'none';
            lockedDashoffset.value = strokeDashoffset;

            // Force a reflow so the browser picks up the starting position before animating
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            svg.offsetHeight; // trigger reflow
            setTimeout(() => {
                circle.style.transition = '';
                circle.style.strokeDashoffset = '';
                lockedDashoffset.value = '';

                svg.style.transition = '';
                svg.style.transform = '';
                cachedLoading.value = newLoading;
                svg.style.animation = '';
                circle.style.animation = '';
            }, 0);
            return;
        }
    }
    cachedLoading.value = newLoading;
});

</script>

<style lang="scss" scoped>

svg {
    border: 0px solid transparent;
    transition: transform 0.35s, opacity 0.35s 0.35s;
}

circle {
    transition: stroke-dashoffset 0.35s, stroke 0.35s;
    transform: rotate(-90deg);
    transform-origin: 50% 50%;
    stroke-linecap: round;
}

svg.spinner {
    animation: spin-progress-ring-spin 2s infinite;

    circle:last-child {
        animation: spin-progress-ring-circle 4s infinite;
    }
}

@keyframes spin-progress-ring-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

@keyframes spin-progress-ring-circle {
    0% { stroke-dashoffset: calc(var(--circle-circumference, 30px) * 0.9); }
    50% { stroke-dashoffset: calc(var(--circle-circumference, 30px) * 0.4); }
    100% { stroke-dashoffset: calc(var(--circle-circumference, 30px) * 0.9); }
}

</style>
