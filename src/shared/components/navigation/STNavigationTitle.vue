<template>
    <h1 class="st-navigation-title">
        <slot />
    </h1>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

@Component
export default class STNavigationTitle extends Vue {}
</script>

<style lang="scss">
@use '~scss/layout/split-inputs.scss';
@use '~scss/base/text-styles.scss';

.st-navigation-title {
    margin-bottom: 20px;
    @extend .style-title-1;
}
</style>
