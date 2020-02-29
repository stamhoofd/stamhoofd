<template>
    <div class="st-view mail-view">
        <STNavigationBar title="Mail versturen">
            <template v-slot:right>
                <button class="button icon gray clock">Geschiedenis</button>
                <button class="button icon close" @click="pop"></button>
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">Mail versturen</span>
        </STNavigationTitle>

        <main>
            <label class="style-label" for="mail-subject">Onderwerp</label>
            <input class="input" type="text" placeholder="Typ hier het onderwerp van je e-mail" id="mail-subject" />

            <label class="style-label" for="mail-text">Bericht</label>
            <MailEditor />
        </main>

        <STToolbar>
            <template v-slot:left>{{ members.length ? members.length : "Geen" }} ontvangers</template>
            <template v-slot:right>
                <button class="button primary">
                    Versturen
                    <div class="dropdown" @click.stop=""></div>
                </button>
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
import MailEditor from "./MailEditor.vue";

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        STToolbar,
        MailEditor
    }
})
export default class MailView extends Mixins(NavigationMixin) {
    @Prop()
    members!: Member[];
}
</script>

<style lang="scss">
@use '~scss/layout/view.scss';

.mail-view {
    padding: 20px var(--st-horizontal-padding, 40px);
}
</style>
