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

    > .right {
        display: flex;
        flex-direction: row;

        align-items: center;
        justify-content: flex-end;

        > .button, > .loading-button {
            margin-left: 10px;
            margin-right: 10px;

            &:first-child {
                margin-left: 0;
            }

            &:last-child {
                margin-right: 0;
            }
        }
    }
}

</style>
