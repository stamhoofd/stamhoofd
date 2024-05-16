<template>
    <div class="st-view member-view">
        <STNavigationBar :title="member.member.details.name">
            <template #right>
                <button v-if="hasPreviousMember || hasNextMember" v-tooltip="'Ga naar vorige lid'" type="button" class="button navigation icon arrow-up" :disabled="!hasPreviousMember" @click="goBack" />
                <button v-if="hasNextMember || hasPreviousMember" v-tooltip="'Ga naar volgende lid'" type="button" class="button navigation icon arrow-down" :disabled="!hasNextMember" @click="goNext" />

                <button v-if="hasWrite" v-tooltip="'Lid bewerken'" class="button icon navigation edit" type="button" @click="editMember" />
                <button v-long-press="(e) => showContextMenu(e)" class="button icon navigation more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ member.member.details.firstName }}</span>
                <MaleIcon v-if="member.member.details.gender == Gender.Male" v-tooltip="member.member.details.defaultAge >= 18 ? 'Man' : 'Jongen'" class="icon-spacer" />
                <FemaleIcon v-if="member.member.details.gender == Gender.Female" v-tooltip="member.member.details.defaultAge >= 18 ? 'Vrouw' : 'Meisje'" class="icon-spacer" />
            </h1>

            <SegmentedControl v-model="tab" :items="tabs" :labels="tabLabels" />
            <component :is="tab" :member="member" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { useAuth, useKeyUpDown, SegmentedControl, FemaleIcon, MaleIcon, MemberStepView, EditMemberGeneralBox, NavigationActions } from '@stamhoofd/components';
import { Gender, Group, PermissionLevel, PlatformMember } from '@stamhoofd/structures';
import { computed, getCurrentInstance, markRaw, ref } from 'vue';
import MemberDetailsTab from './tabs/MemberDetailsTab.vue';

const props = withDefaults(
    defineProps<{
        member: PlatformMember,
        initialTab?: number | null,
        group?: Group | null,
        cycleOffset?: number,
        waitingList?: boolean,
        getNext: (current: PlatformMember) => PlatformMember | null,
        getPrevious: (current: PlatformMember) => PlatformMember | null,
    }>(),
    {
        initialTab: null,
        group: null,
        cycleOffset: 0,
        waitingList: false
    }
);

const tabs: unknown[] = [markRaw(MemberDetailsTab)]; //[MemberViewDetails, MemberViewPayments];
const tabLabels = ["Gegevens", "Rekening"];
const tab = ref(tabs[props.initialTab && props.initialTab < tabs.length ? (props.initialTab) : 0]);
const tabIndex = computed(() => {
    return Math.max(0, tabs.findIndex(t => t === tab.value))
});
const show = useShow();
const present = usePresent();
const auth = useAuth();
const hasWrite = computed(() => {
    return auth.canAccessPlatformMember(props.member, PermissionLevel.Write)
})

useKeyUpDown({
    up: goBack,
    down: goNext
})

// Start loading the member



// import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
// import { BackButton, FemaleIcon, LongPressDirective, MaleIcon, SegmentedControl, STNavigationBar, STNavigationTitle, TooltipDirective } from "@stamhoofd/components";
// import TableActionsContextMenu from "@stamhoofd/components/src/tables/TableActionsContextMenu.vue";
// import { UrlHelper } from "@stamhoofd/networking";
// import { Gender, Group, MemberWithRegistrations } from '@stamhoofd/structures';
// import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
// 
// import { FamilyManager } from '../../../classes/FamilyManager';
// 
// import { MemberActionBuilder } from "../groups/MemberActionBuilder";
// import EditMemberView from "./edit/EditMemberView.vue";
// import MemberViewDetails from "./MemberViewDetails.vue";
// import MemberViewPayments from "./MemberViewPayments.vue";
// 
// @Component({
//     components: {
//         STNavigationBar,
//         STNavigationTitle,
//         SegmentedControl,
//         MaleIcon,
//         FemaleIcon,
//         BackButton
//     },
//     directives: {
//         Tooltip: TooltipDirective,
//         LongPress: LongPressDirective
//     }
// })
// export default class MemberView extends Mixins(NavigationMixin) {
//     @Prop()
//         member!: MemberWithRegistrations;
// 
//     @Prop({ default: null })
//         initialTab!: number | null
// 
//     @Prop({ default: null })
//         group: Group | null;
// 
//     @Prop({ default: 0 })
//         cycleOffset!: number
// 
//     @Prop({ default: false })
//         waitingList!: boolean
// 
//     tabs = [MemberViewDetails, MemberViewPayments];
//     tabLabels = ["Gegevens", "Rekening"];
//     tab = this.tabs[this.initialTab && this.initialTab < this.tabs.length ? (this.initialTab) : 0];
// 
//     familyManager = new FamilyManager(this.$memberManager, [this.member]);
// 
//     @Prop({ default: null })
//         getNextMember!: (MemberWithRegistrations) => MemberWithRegistrations | null;
// 
//     @Prop({ default: null })
//         getPrevious!: (MemberWithRegistrations) => MemberWithRegistrations | null;
// 
//     mounted() {
//         UrlHelper.addSearchParam("member", this.member.id);
//     }
// 
//     get registrations() {
//         return this.member.filterRegistrations({groups: this.group ? [this.group] : undefined, waitingList: this.waitingList, cycleOffset: this.cycleOffset})
//     }
// 
//     get defaultRegistration() {
//         return this.registrations[0] ?? this.member.activeRegistrations[0] ?? null
//     }
//     
//     created() {
//         (this as any).Gender = Gender;
//     }
// 
//     get hasNextMember(): boolean {
//         if (!this.getNextMember) {
//             return false
//         }
//         return !!this.getNextMember(this.member);
//     }
// 
const hasPreviousMember = computed(() => {
    if (!props.getPrevious) {
        return false
    }
    return !!props.getPrevious(props.member);
});

const hasNextMember = computed(() => {
    if (!props.getNext) {
        return false
    }
    return !!props.getNext(props.member);
});

const instance = getCurrentInstance()
async function seek(previous = true) {
    const member = previous ? props.getPrevious(props.member) : props.getNext(props.member)
    if (!member) {
        return;
    }
    const component = new ComponentWithProperties(instance!.type, {
        ...props,
        member: member,
        initialTab: tabIndex.value
    });

    await show({
        components: [component],
        replace: 1,
        reverse: previous,
        animated: false
    })
}

async function goBack() {
    await seek(true);
}

async function goNext() {
    await seek(false);
}

async function editMember() {
    await present({
        components: [
            new ComponentWithProperties(MemberStepView, {
                member: props.member,
                title: props.member.member.firstName + ' bewerken',
                component: EditMemberGeneralBox,
                saveHandler: async ({dismiss}: NavigationActions) => {
                    await dismiss({force: true});
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

function showContextMenu() {
    // todo
}


//     activated() {
//         // eslint-disable-next-line @typescript-eslint/unbound-method
//         document.addEventListener("keydown", this.onKey);
//     }
// 
//     deactivated() {
//         // eslint-disable-next-line @typescript-eslint/unbound-method
//         document.removeEventListener("keydown", this.onKey);
//     }
// 

// 
//     get hasWrite(): boolean {
//         if (this.$context.organizationAuth.hasFullAccess()) {
//             return true;
//         }
// 
//         for (const group of this.member.groups) {
//             if (group.privateSettings && group.hasWriteAccess(this.$context.organizationPermissions, this.$organization)) {
//                 return true
//             }
//         }
//         
//         return false
//     }
// 
//     get actions() {
//         const builder = new MemberActionBuilder({
//             $organizationManager: this.$organizationManager,
//             $memberManager: this.$memberManager,
//             component: this,
//             groups: this.group ? [this.group] : this.member.groups,
//             cycleOffset: this.cycleOffset,
//             inWaitingList: this.waitingList,
//             hasWrite: this.hasWrite,
//         })
// 
//         return builder.getActions()
//     }
// 
//     showContextMenu(event) {
//         const el = event.currentTarget;
//         const bounds = el.getBoundingClientRect()
// 
//         const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
//             x: bounds.left,
//             y: bounds.bottom,
//             xPlacement: "right",
//             yPlacement: "bottom",
//             actions: this.actions,
//             selection: {
//                 isSingle: true,
//                 hasSelection: true,
//                 getSelection: () => {
//                     return [this.member]
//                 }
//             }
//         });
//         this.present(displayedComponent.setDisplayStyle("overlay"));
//     }
// 
//     editMember() {
//         const displayedComponent = new ComponentWithProperties(EditMemberView, {
//             member: this.member,
//             initialFamily: this.familyManager
//         }).setDisplayStyle("popup");
//         this.present(displayedComponent);
//     }
// }
</script>
