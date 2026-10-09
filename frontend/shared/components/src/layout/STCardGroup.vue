<template>
    <div class="st-card-group" :class="{ columns }">
        <slot />
    </div>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        /**
         * Place the cards next to each other where there is room
         */
        columns?: boolean;
    }>(),
    {
        columns: false,
    },
);
</script>

<style lang="scss">
.st-card-group {
    display: grid;
    gap: 10px;
    margin: 15px 0;

    &:first-child {
        margin-top: 0;
    }

    &:last-child {
        margin-bottom: 0;
    }

    &.columns {
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }
}
</style>
