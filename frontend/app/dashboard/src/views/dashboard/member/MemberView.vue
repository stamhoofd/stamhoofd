<template>
    <div class="st-view member-view">
        <STNavigationBar :title="member.details.name">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
                <button v-if="hasPreviousMember" class="button text" @click="goBack">
                    <span class="icon arrow-left" />
                    <span>Vorige</span>
                </button>
            </template>
            <template #right>
                <button v-if="hasNextMember" class="button text" @click="goNext">
                    <span>Volgende</span>
                    <span class="icon arrow-right" />
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1>
                <span class="icon-spacer">{{ member.details.name }}</span>
                <MaleIcon v-if="member.details.gender == Gender.Male" class="icon-spacer" />
                <FemaleIcon v-if="member.details.gender == Gender.Female" class="icon-spacer" />
                <button class="button icon gray more" @click="showContextMenu" />
            </h1>

            <SegmentedControl v-model="tab" :items="tabs" :labels="tabLabels" />
            <component :is="tab" :member="member" :family-manager="familyManager" />
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationTitle } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton,FemaleIcon, MaleIcon, SegmentedControl } from "@stamhoofd/components";
import { Gender,Group,MemberWithRegistrations } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import MemberContextMenu from "./MemberContextMenu.vue";
import MemberViewDetails from "./MemberViewDetails.vue";
import MemberViewPayments from "./MemberViewPayments.vue";

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        MaleIcon,
        FemaleIcon,
        BackButton
    },
})
export default class MemberView extends Mixins(NavigationMixin) {
    @Prop()
    member!: MemberWithRegistrations;

    @Prop({ default: null })
    initialTab!: number | null

    @Prop({ default: null })
    group: Group | null;

    @Prop({ default: 0 })
    cycleOffset!: number

    @Prop({ default: false })
    waitingList!: boolean

    tabs = [MemberViewDetails, MemberViewPayments];
    tab = this.tabs[this.payments.length > 0 ? (this.initialTab ?? 0) : 0];
    tabLabels = ["Gegevens", "Betaling"];

    familyManager = new FamilyManager([this.member]);

    @Prop({ default: null })
    getNextMember!: (MemberWithRegistrations) => MemberWithRegistrations | null;

    @Prop({ default: null })
    getPreviousMember!: (MemberWithRegistrations) => MemberWithRegistrations | null;

    created() {
        (this as any).Gender = Gender;
    }

    get hasNextMember(): boolean {
        if (!this.getNextMember) {
            return false
        }
        return !!this.getNextMember(this.member);
    }

    get hasPreviousMember(): boolean {
        if (!this.getPreviousMember) {
            return false
        }
        return !!this.getPreviousMember(this.member);
    }

    get payments() {
        return this.member.registrations.flatMap(r => r.payment ? [r.payment] : [])
    }

    get tabIndex() {
        return Math.max(0, this.tabs.findIndex(t => t === this.tab))
    }

    goBack() {
        const member = this.getPreviousMember(this.member);
        if (!member) {
            return;
        }
        const component = new ComponentWithProperties(MemberView, {
            member: member,
            getNextMember: this.getNextMember,
            getPreviousMember: this.getPreviousMember,
            initialTab: this.tabIndex,

            group: this.group,
            cycleOffset: this.cycleOffset,
            waitingList: this.waitingList
        });
        this.navigationController?.push(component, true, 1, true);
    }

    goNext() {
        const member = this.getNextMember(this.member);
        if (!member) {
            return;
        }
        const component = new ComponentWithProperties(MemberView, {
            member: member,
            getNextMember: this.getNextMember,
            getPreviousMember: this.getPreviousMember,
            initialTab: this.tabIndex,

            group: this.group,
            cycleOffset: this.cycleOffset,
            waitingList: this.waitingList
        });
        this.navigationController?.push(component, true, 1, false);
    }

    activated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.addEventListener("keydown", this.onKey);
    }

    deactivated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.removeEventListener("keydown", this.onKey);
    }

    onKey(event) {
        if (event.defaultPrevented || event.repeat) {
            return;
        }

        const key = event.key || event.keyCode;

        if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") {
            this.goBack();
            event.preventDefault();
        } else if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown") {
            this.goNext();
            event.preventDefault();
        }
    }

    showContextMenu(event) {
        const displayedComponent = new ComponentWithProperties(MemberContextMenu, {
            x: event.clientX,
            y: event.clientY,
            member: this.member,
            group: this.group,
            cycleOffset: this.cycleOffset,
            waitingList: this.waitingList
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.member-view {
    > main {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }
}
</style>
