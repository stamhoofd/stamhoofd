<template>
    <div class="st-view sms-view">
        <STNavigationBar title="SMS'en">
            <template v-slot:right>
                <button class="button icon gray clock">Geschiedenis</button>
                <button class="button icon close" @click="pop"></button>
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">SMS'en</span>
        </STNavigationTitle>

        <main>
            <label class="style-label" for="sms-who">Naar wie?</label>
            <select class="input" id="sms-who">
                <option>Enkel naar ouders</option>
                <option>Enkel naar leden</option>
                <option>Ouders en leden</option>
            </select>

            <label class="style-label" for="sms-text">Bericht</label>
            <textarea class="input" id="sms-text" placeholder="Typ hier je SMS-bericht"></textarea>
        </main>

        <STToolbar>
            <template v-slot:left>{{ members.length ? members.length : "Geen" }} ontvangers</template>
            <template v-slot:right>
                <button class="button primary">Versturen</button>
            </template>
        </STToolbar>
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
import STToolbar from "shared/components/navigation/STToolbar.vue";

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        STToolbar
    }
})
export default class SMSView extends Mixins(NavigationMixin) {
    @Prop()
    members!: Member[];
}
</script>

<style lang="scss">
@use '~scss/layout/view.scss';

.sms-view {
    > main {
        display: flex;
        flex-grow: 1;
        flex-direction: column;
        padding-bottom: 20px;

        & > textarea {
            flex-grow: 1;
        }
    }
}
</style>
