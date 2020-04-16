<template>
    <button />
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class MoreButton extends Vue {}
</script>

<style lang="scss" scoped>
@use "~scss/components/checkbox.scss";
button {
    margin: 0 10px;
    width: 24px;
    height: 24px;
    vertical-align: middle;
    display: inline-block;
    background: url(~assets/images/icons/gray/more.svg) center center no-repeat;
    cursor: pointer;

    &:active {
        opacity: 0.5;
    }
}
</style>
