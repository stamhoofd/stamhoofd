<template>
    <div class="tab-bar-replacement-view">
        <div class="left">
            left
        </div>

        <div class="right">
            right
        </div>
    </div>
</template>

<script setup lang="ts">

</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.tab-bar-replacement-view {
    display: grid;
    grid-template-columns: 1fr auto;
    height: 100%;
    align-items: center;

    > .left {
        // todo
    }
}

</style>
