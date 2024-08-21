<template>
    <div v-if="label" :class="labelClass">
        {{ label }}
    </div>
    <div class="style-dark" :class="{'no-label': label === undefined}">
        <div v-if="value !== undefined">
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
    valueClass?: string
}>();
</script>

<style lang="scss" scoped>
.no-label {
    grid-column: span 2;
}
</style>
