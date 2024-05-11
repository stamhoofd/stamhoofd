<template>
    <div class="context-navigation-bar">
        <div class="left">
            <InheritComponent name="tabbar-left" :override-props="{small: true}" />
        </div>

        <div class="right">
            <InheritComponent name="tabbar-right" />
        </div>
    </div>
</template>

<script setup lang="ts">
import InheritComponent from '../containers/InheritComponent.vue';


</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.context-navigation-bar{
    display: grid;
    grid-template-columns: 1fr auto;
    height: 100%;
    align-items: center;
    --block-width: 25px;
}

</style>
