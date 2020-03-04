<template>
    <div class="st-view member-view">
        <STNavigationBar :title="member.name">
            <template v-slot:left>
                <button class="button icon gray arrow-left" v-if="hasPreviousMember" @click="goBack">Vorige</button>
            </template>
            <template v-slot:right>
                <button class="button icon gray arrow-right" v-if="hasNextMember" @click="goNext">Volgende</button>
                <button class="button icon close" @click="pop"></button>
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">{{ member.name }}</span>
            <MaleIcon class="icon-spacer" v-if="member.gender == Gender.Male" />
            <FemaleIcon class="icon-spacer" v-if="member.gender == Gender.Female" />
            <button class="button more" @click="showContextMenu"></button>
        </STNavigationTitle>

        <SegmentedControl :items="tabs" :labels="tabLabels" v-model="tab" />

        <main>
            <component :is="tab" :member="member" />
        </main>
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
import MaleIcon from "shared/components/icons/MaleIcon.vue";
import FemaleIcon from "shared/components/icons/FemaleIcon.vue";
import { Gender } from "shared/models/Gender";

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        MaleIcon,
        FemaleIcon
    }
})
export default class MemberView extends Mixins(NavigationMixin) {
    tabs = [MemberViewDetails, MemberViewPayments, MemberViewHistory];
    tab = this.tabs[0];
    tabLabels = ["Steekkaart", "Betaling", "Geschiedenis"];

    @Prop()
    member!: Member;

    @Prop()
    getNextMember!: (Member) => Member | null;

    @Prop()
    getPreviousMember!: (Member) => Member | null;

    created() {
        (this as any).Gender = Gender;
    }

    get hasNextMember(): boolean {
        return !!this.getNextMember(this.member);
    }

    get hasPreviousMember(): boolean {
        return !!this.getPreviousMember(this.member);
    }

    goBack() {
        var member = this.getPreviousMember(this.member);
        if (!member) {
            return;
        }
        var component = new ComponentWithProperties(MemberView, {
            member: member,
            getNextMember: this.getNextMember,
            getPreviousMember: this.getPreviousMember
        });
        this.navigationController.push(component, true, true, true);
    }

    goNext() {
        var member = this.getNextMember(this.member);
        if (!member) {
            return;
        }
        var component = new ComponentWithProperties(MemberView, {
            member: member,
            getNextMember: this.getNextMember,
            getPreviousMember: this.getPreviousMember
        });
        this.navigationController.push(component, true, true, false);
    }

    activated() {
        document.addEventListener("keydown", this.onKey);
    }

    deactivated() {
        document.removeEventListener("keydown", this.onKey);
    }

    onKey(event) {
        if (event.defaultPrevented || event.repeat) {
            return;
        }

        var key = event.key || event.keyCode;

        if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") {
            this.goBack();
            event.preventDefault();
        } else if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown") {
            this.goNext();
            event.preventDefault();
        }
    }

    showContextMenu(event) {
        var displayedComponent = new ComponentWithProperties(MemberContextMenu, {
            x: event.clientX,
            y: event.clientY,
            member: this.member
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }
}
</script>

<style lang="scss">
@use '~scss/layout/view.scss';

.member-view {
    > main {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }
}
</style>
