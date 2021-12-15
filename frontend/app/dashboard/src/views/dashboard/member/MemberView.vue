<template>
    <div class="st-view member-view">
        <STNavigationBar :title="member.details.firstName" :pop="canPop" :dismiss="canDismiss">
            <template #right>
                <button v-if="hasPreviousMember || hasNextMember" v-tooltip="'Ga naar vorige lid'" class="button navigation icon arrow-up" :disabled="!hasPreviousMember" @click="goBack" />
                <button v-if="hasNextMember || hasPreviousMember" v-tooltip="'Ga naar volgende lid'" class="button navigation icon arrow-down" :disabled="!hasNextMember" @click="goNext" />

                <button v-tooltip="'Lid bewerken'" class="button icon navigation edit" @click="editMember" />
                <button v-long-press="(e) => showContextMenu(e)" class="button icon navigation more" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ member.details.firstName }}</span>
                <MaleIcon v-if="member.details.gender == Gender.Male" v-tooltip="member.details.age >= 18 ? 'Man' : 'Jongen'" class="icon-spacer" />
                <FemaleIcon v-if="member.details.gender == Gender.Female" v-tooltip="member.details.age >= 18 ? 'Vrouw' : 'Meisje'" class="icon-spacer" />
            </h1>

            <SegmentedControl v-model="tab" :items="tabs" :labels="tabLabels" />
            <component :is="tab" :member="member" :family-manager="familyManager" />
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { LongPressDirective, STNavigationTitle, TooltipDirective } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton,FemaleIcon, MaleIcon, SegmentedControl } from "@stamhoofd/components";
import TableActionsContextMenu from "@stamhoofd/components/src/tables/TableActionsContextMenu.vue";
import { Gender,getPermissionLevelNumber,Group,MemberWithRegistrations, PermissionLevel } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import { OrganizationManager } from "../../../classes/OrganizationManager";
import { MemberActionBuilder } from "../groups/MemberActionBuilder";
import EditMemberView from "./edit/EditMemberView.vue";
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
        Tooltip: TooltipDirective,
        LongPress: LongPressDirective
    }
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
            reverse: true,
            animated: false
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
            waitingList: this.waitingList,
        });

        this.show({
            components: [component],
            replace: 1,
            animated: false
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

    get hasWrite(): boolean {
        if (!OrganizationManager.user.permissions) {
            return false
        }

        if (OrganizationManager.user.permissions.hasFullAccess()) {
            // Can edit members without groups
            return true
        }

        for (const group of this.member.groups) {
            if(group.privateSettings && getPermissionLevelNumber(group.privateSettings.permissions.getPermissionLevel(OrganizationManager.user.permissions)) >= getPermissionLevelNumber(PermissionLevel.Write)) {
                return true
            }
        }
        
        return false
    }

    get actions() {
        const builder = new MemberActionBuilder({
            component: this,
            group: this.group,
            cycleOffset: this.cycleOffset,
            inWaitingList: this.waitingList,
            hasWrite: this.hasWrite,
        })

        return builder.getActions()
    }

    showContextMenu(event) {
        const el = event.currentTarget;
        const bounds = el.getBoundingClientRect()

        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x: bounds.left,
            y: bounds.bottom,
            xPlacement: "right",
            yPlacement: "bottom",
            actions: this.actions,
            focused: [this.member]
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