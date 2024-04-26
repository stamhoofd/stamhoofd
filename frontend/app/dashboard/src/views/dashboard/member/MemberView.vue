<template>
    <div class="st-view member-view">
        <STNavigationBar :title="member.details.firstName" :pop="canPop" :dismiss="canDismiss">
            <template #right>
                <button v-if="hasPreviousMember || hasNextMember" v-tooltip="'Ga naar vorige lid'" type="button" class="button navigation icon arrow-up" :disabled="!hasPreviousMember" @click="goBack" />
                <button v-if="hasNextMember || hasPreviousMember" v-tooltip="'Ga naar volgende lid'" type="button" class="button navigation icon arrow-down" :disabled="!hasNextMember" @click="goNext" />

                <button v-if="hasWrite" v-tooltip="'Lid bewerken'" class="button icon navigation edit" type="button" @click="editMember" />
                <button v-long-press="(e) => showContextMenu(e)" class="button icon navigation more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ member.details.firstName }}</span>
                <MaleIcon v-if="member.details.gender == Gender.Male" v-tooltip="member.details.age >= 18 ? 'Man' : 'Jongen'" class="icon-spacer" />
                <FemaleIcon v-if="member.details.gender == Gender.Female" v-tooltip="member.details.age >= 18 ? 'Vrouw' : 'Meisje'" class="icon-spacer" />
            </h1>

            <SegmentedControl v-model="tab" :items="tabs" :labels="tabLabels" />
            <component :is="tab" :member="member" :family-manager="familyManager" :default-registration="defaultRegistration" />
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, FemaleIcon, LongPressDirective, MaleIcon, SegmentedControl, STNavigationBar, STNavigationTitle, TooltipDirective } from "@stamhoofd/components";
import TableActionsContextMenu from "@stamhoofd/components/src/tables/TableActionsContextMenu.vue";
import { UrlHelper } from "@stamhoofd/networking";
import { Gender, Group, MemberWithRegistrations } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';

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
    tabLabels = ["Gegevens", "Rekening"];
    tab = this.tabs[this.initialTab && this.initialTab < this.tabs.length ? (this.initialTab) : 0];

    familyManager = new FamilyManager(this.$memberManager, [this.member]);

    @Prop({ default: null })
        getNextMember!: (MemberWithRegistrations) => MemberWithRegistrations | null;

    @Prop({ default: null })
        getPreviousMember!: (MemberWithRegistrations) => MemberWithRegistrations | null;

    mounted() {
        UrlHelper.addSearchParam("member", this.member.id);
    }

    get registrations() {
        return this.member.filterRegistrations({groups: this.group ? [this.group] : undefined, waitingList: this.waitingList, cycleOffset: this.cycleOffset})
    }

    get defaultRegistration() {
        return this.registrations[0] ?? this.member.activeRegistrations[0] ?? null
    }
    
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
        if (!this.$organizationManager.user.permissions) {
            return false
        }

        if (this.$organizationManager.user.permissions.hasFullAccess(this.$organization.privateMeta?.roles ?? [])) {
            // Can edit members without groups
            return true
        }

        for (const group of this.member.groups) {
            if(group.privateSettings && group.hasWriteAccess(this.$organizationManager.user.permissions, this.$organization)) {
                return true
            }
        }
        
        return false
    }

    get actions() {
        const builder = new MemberActionBuilder({
            $organizationManager: this.$organizationManager,
            $memberManager: this.$memberManager,
            component: this,
            groups: this.group ? [this.group] : this.member.groups,
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
            selection: {
                isSingle: true,
                hasSelection: true,
                getSelection: () => {
                    return [this.member]
                }
            }
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