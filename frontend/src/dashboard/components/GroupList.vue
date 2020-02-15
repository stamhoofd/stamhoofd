<template>
    <div style="padding: 40px 40px">
        <p><button class="button" v-if="canPop" @click="pop">Terug</button></p>

        <h1>Kapoenen</h1>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
        <p>Dit is een test</p>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

import SegmentedControl from "shared/components/inputs/SegmentedControl.vue";
import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";
import EditGroupDetail from "./EditGroupDetail.vue";
import { NavigationMixin } from "shared/classes/NavigationMixin";

@Component({})
export default class GroupList extends Mixins(NavigationMixin) {}
</script>

<style scoped lang="scss">
// This should be @use, but this won't work with webpack for an unknown reason? #bullshit
@use '~scss/layout/split-inputs.scss';
@use '~scss/base/text-styles.scss';
@use '~scss/components/inputs.scss';
@use '~scss/components/buttons.scss';

h1 {
    @extend .style-title-1;
}
</style>
