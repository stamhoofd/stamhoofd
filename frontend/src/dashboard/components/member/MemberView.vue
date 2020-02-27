<template>
    <div class="member-view">
        <STNavigationBar title="Rodolphus Lestrange">
            <template v-slot:left>
                <button class="button icon gray arrow-left">Vorige</button>
            </template>
            <template v-slot:right>
                <button class="button icon gray arrow-right">Volgende</button>
                <button class="button icon close" @click="pop"></button>
            </template>
        </STNavigationBar>
        <STNavigationTitle
            >Rodolphus Lestrange<button class="button more" @click="showContextMenu"></button
        ></STNavigationTitle>

        <SegmentedControl :items="tabs" :labels="tabLabels" v-model="tab" />

        <component :is="tab" />
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";
import { NavigationMixin } from "shared/classes/NavigationMixin";
import Checkbox from "shared/components/inputs/Checkbox.vue";
import { Member } from "shared/models/Member";
import GroupListShort from "./GroupListShort.vue";
import NavigationController from "shared/components/layout/NavigationController.vue";
import STNavigationBar from "shared/components/navigation/STNavigationBar.vue";
import STNavigationTitle from "shared/components/navigation/STNavigationTitle.vue";
import SegmentedControl from "shared/components/inputs/SegmentedControl.vue";
import MemberViewDetails from "./MemberViewDetails.vue";
import MemberViewPayments from "./MemberViewPayments.vue";
import MemberViewHistory from "./MemberViewHistory.vue";
import MemberContextMenu from "./MemberContextMenu.vue";

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl
    }
})
export default class MemberView extends Mixins(NavigationMixin) {
    tabs = [MemberViewDetails, MemberViewPayments, MemberViewHistory];
    tab = this.tabs[0];
    tabLabels = ["Steekkaart", "Betaling", "Geschiedenis"];

    showContextMenu(event) {
        var displayedComponent = new ComponentWithProperties(MemberContextMenu, {
            x: event.clientX,
            y: event.clientY
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }
}
</script>

<style lang="scss">
// This should be @use, but this won't work with webpack for an unknown reason? #bullshit
.member-view {
    padding: 0 var(--st-horizontal-padding, 40px);
}
</style>
