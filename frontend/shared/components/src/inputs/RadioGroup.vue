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
.radio-group {
    display: flex;
    flex-wrap: wrap;

    .radio {
        flex-shrink: 0;
        padding-right: 20px;
    }

    &.column {
        flex-direction: column;
        flex-wrap: nowrap;
    }

    @media (max-width: 550px) {
        flex-direction: column;
        flex-wrap: nowrap;
    }
}
</style>
