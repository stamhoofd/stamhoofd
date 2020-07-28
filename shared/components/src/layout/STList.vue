<template>
    <div class="st-list">
        <slot />
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";

@Component({})
export default class STList extends Vue {
}
</script>

<style lang="scss">
@use '~@stamhoofd/scss/base/variables' as *;

.st-list {
    padding: 0;
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
}
</style>