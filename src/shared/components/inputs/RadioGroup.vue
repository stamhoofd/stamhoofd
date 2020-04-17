<template>
    <div class="radio-group">
        <slot />
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class RadioGroup extends Vue {}
</script>

<style lang="scss">
@use '~scss/components/inputs.scss';

.radio-group {
    display: flex;
    flex-wrap: wrap;
    margin: 10px 0;

    .radio {
        flex-shrink: 0;
        padding-right: 20px;
    }
}
</style>
