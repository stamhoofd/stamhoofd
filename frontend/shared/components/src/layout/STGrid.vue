<template>
    <div class="st-grid">
        <slot />
    </div>
</template>

<script setup lang="ts">

</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.st-grid {
    padding: 0;
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
    position: relative;
    display: grid;
    gap: calc(2 * var(--st-list-padding, 15px)) 0;
    grid-template-columns: [start] var(--st-horizontal-padding, 40px) auto [line-start] 1fr auto auto var(--st-horizontal-padding, 40px) [end line-end];

    padding-top: var(--st-list-padding-top, var(--st-list-padding, 15px));
    padding-bottom: var(--st-list-padding-bottom, var(--st-list-padding, 15px));

    .st-list > & {
        // Allow stacking if we need partial draggable area
        margin: 0;
    }

    +.style-button-bar {
        margin-top: 15px;
    }

}
</style>
