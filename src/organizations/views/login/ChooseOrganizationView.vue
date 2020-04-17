<template>
    <div class="st-view group-list">
        TODO
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from "vue-property-decorator";
import { NavigationMixin } from "@/shared/classes/NavigationMixin";

@Component({})
export default class ChooseOrganizationView extends Mixins(NavigationMixin) {
}
</script>

<style lang="scss">
@use '~scss/layout/split-inputs.scss';
@use '~scss/base/text-styles.scss';
@use '~scss/components/inputs.scss';
@use '~scss/components/buttons.scss';
@use '~scss/layout/view.scss';
</style>
