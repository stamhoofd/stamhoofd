<template>
    <div class="root">
        <STNavigationBar title="Rodolphus Lestrange">
            <template v-slot:left>
                <button>Vorige</button>
            </template>
            <template v-slot:right>
                <button>Volgende</button>
                <button>Sluiten</button>
            </template>
        </STNavigationBar>
        <STNavigationTitle>Rodolphus Lestrange<button class="button more"></button></STNavigationTitle>

        <p v-for="(n, index) in 100" :key="index">Dit is een test</p>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

import SegmentedControl from "shared/components/inputs/SegmentedControl.vue";
import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";
import { NavigationMixin } from "shared/classes/NavigationMixin";
import Checkbox from "shared/components/inputs/Checkbox.vue";
import { Member } from "shared/models/Member";
import GroupListShort from "./GroupListShort.vue";
import NavigationController from "shared/components/layout/NavigationController.vue";
import STNavigationBar from "shared/components/navigation/STNavigationBar.vue";
import STNavigationTitle from "shared/components/navigation/STNavigationTitle.vue";

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle
    }
})
export default class MemberView extends Mixins(NavigationMixin) {}
</script>

<style scoped lang="scss">
// This should be @use, but this won't work with webpack for an unknown reason? #bullshit
.root {
    padding: 0 var(--st-horizontal-padding, 40px);
}
</style>
