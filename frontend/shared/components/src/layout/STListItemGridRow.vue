<template>
    <div v-if="label" :class="[labelClass, {'style-dark': emphasizeLabel}]">
        {{ label }}
    </div>
    <div :class="{'no-label': label === undefined, 'style-dark': !emphasizeLabel}">
        <div v-if="value !== undefined" :class="valueClass">
            {{ value }}
        </div>
        <slot v-else />
    </div>
    <div />
</template>

<script lang="ts" setup>

defineProps<{
    label?: string,
    value?: string,
    labelClass?: string,
    valueClass?: string,
    emphasizeLabel?: boolean
}>();
</script>

<style lang="scss" scoped>
.no-label {
    grid-column: span 2;
}
</style>
