<template>
    <h1 class="st-navigation-title">
        <slot />
    </h1>
</template>

<script lang="ts">
import { Component, VueComponent } from "@simonbackx/vue-app-navigation/classes";

@Component
export default class STNavigationTitle extends VueComponent {}
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/text-styles.scss';

.st-navigation-title {
    margin-bottom: 20px;
    @extend .style-title-1;
}
</style>
