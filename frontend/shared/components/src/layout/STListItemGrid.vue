<template>
    <div class="st-list-item-grid style-description-small">
        <slot />
    </div>
</template>

<script lang="ts" setup>

</script>

<style lang="scss" scoped>
.st-list-item-grid {
    display: grid;
    grid-template-columns: auto auto 1fr;
    column-gap: 15px;
    row-gap: 5px;
    padding-top: 7px;
}
</style>
