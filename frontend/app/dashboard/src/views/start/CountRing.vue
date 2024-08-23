<template>
    <svg
        :height="radius * 2"
        :width="radius * 2"
        :style="`border-width: ${borderWidth}px`"
        :class="customClass"
    >
        <circle
            fill="var(--color-primary, #0053ff)"
            :r="radius"
            :cx="radius"
            :cy="radius"
        />
        <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" :font-size="radius * 1.5" fill="white" lengthAdjust="spacingAndGlyphs">{{ count }}</text>
    </svg>
</template>

<script setup lang="ts">

withDefaults(defineProps<{count: number, radius: number, borderWidth?: number, customClass?: string}>(), {
    borderWidth: 0,
    customClass: ''
});
</script>

<style lang="scss" scoped>

text {
    font-weight: bold;
}
</style>
