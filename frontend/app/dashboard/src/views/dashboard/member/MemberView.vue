<template>
    <div class="st-view member-view">
        <STNavigationBar :title="member.details.name" :pop="canPop" :dismiss="canDismiss">
            <template #right>
                <button v-if="hasPreviousMember" class="button navigation icon arrow-up" @click="goBack" />
                <button v-if="hasNextMember" class="button navigation icon arrow-down" @click="goNext" />

                <button class="button icon navigation edit" @click="editMember" />
                <button class="button icon navigation more" @click="showContextMenu" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title with-icons">
                <span v-copyable class="icon-spacer">{{ member.details.name }}</span>
                <MaleIcon v-if="member.details.gender == Gender.Male" class="icon-spacer" />
                <FemaleIcon v-if="member.details.gender == Gender.Female" class="icon-spacer" />
            </h1>

            <SegmentedControl v-model="tab" :items="tabs" :labels="tabLabels" />
            <component :is="tab" :member="member" :family-manager="familyManager" />
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CopyableDirective, STNavigationTitle } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton,FemaleIcon, MaleIcon, SegmentedControl } from "@stamhoofd/components";
import { Gender,Group,MemberWithRegistrations } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import EditMemberView from "./edit/EditMemberView.vue";
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
    directives: {
        Copyable: CopyableDirective,
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

        this.show({
            components: [component],
            replace: 1,
            reverse: true
        })
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

        this.show({
            components: [component],
            replace: 1,
        })
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

        if (!this.isFocused()) {
            return
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
        const el = event.currentTarget;
        const bounds = el.getBoundingClientRect()

        const displayedComponent = new ComponentWithProperties(MemberContextMenu, {
            x: bounds.left + el.offsetWidth,
            y: bounds.top + el.offsetHeight,

            xPlacement: "left",
            yPlacement: "bottom",

            member: this.member,
            group: this.group,
            cycleOffset: this.cycleOffset,
            waitingList: this.waitingList
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    editMember() {
        const displayedComponent = new ComponentWithProperties(EditMemberView, {
            member: this.member,
            initialFamily: this.familyManager
        }).setDisplayStyle("popup");
        this.present(displayedComponent);
    }
}
</script>