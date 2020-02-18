<template>
    <div style="padding: 40px 40px">
        <div class="sticky">Sticky me!</div>

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

        <p><button class="button primary" @click="next">Volgende</button></p>
        <p><button class="button" v-if="canPop" @click="pop">Terug</button></p>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

import SegmentedControl from "shared/components/inputs/SegmentedControl.vue";
import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";
import { NavigationMixin } from "shared/classes/NavigationMixin";

@Component({})
export default class GroupList extends Mixins(NavigationMixin) {
    next() {
        this.show(new ComponentWithProperties(GroupList, {}));
    }
}
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

.sticky {
    background: white;
    top: 0;
    padding: 20px;
    position: sticky;
}
</style>
