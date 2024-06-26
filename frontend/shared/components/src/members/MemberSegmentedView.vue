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

            <SegmentedControl v-model="tab" :items="tabComponents" :labels="tabLabels" />
            <component :is="tab" :member="member" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { ContextMenu, ContextMenuItem, EditMemberAllBox, FemaleIcon, MaleIcon, NavigationActions, SegmentedControl, useAuth, useKeyUpDown, useOrganization } from '@stamhoofd/components';
import { AccessRight, Gender, Group, PermissionLevel, PlatformMember } from '@stamhoofd/structures';
import { computed, getCurrentInstance, markRaw, ref } from 'vue';
import MemberDetailsTab from './tabs/MemberDetailsTab.vue';
import MemberStepView from './MemberStepView.vue';
import MemberPaymentsTab from './tabs/MemberPaymentsTab.vue';
import MemberPlatformConnectionTab from './tabs/MemberPlatformConnectionTab.vue';
import EditMemberResponsibilitiesBox from './components/edit/EditMemberResponsibilitiesBox.vue';

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
const auth = useAuth();
const show = useShow();
const present = usePresent();
const organization = useOrganization();

const tabs = computed(() => {
    const base: {name: string, component: unknown}[] = [{
        name: "Gegevens",
        component: markRaw(MemberDetailsTab)
    }]; 

    if (STAMHOOFD.userMode === 'platform') {
        base.push({
            name: 'Aansluiting',
            component: markRaw(MemberPlatformConnectionTab)
        });
    }

    if (organization.value && auth.hasAccessRight(AccessRight.MemberReadFinancialData)) {
        base.push({
            name: 'Rekening',
            component: markRaw(MemberPaymentsTab)
        });
    }

    return base
});

const tabComponents = computed(() => {
    return tabs.value.map(t => t.component)
});
const tabLabels = computed(() => {
    return tabs.value.map(t => t.name)
});

const tab = ref(tabComponents.value[props.initialTab && props.initialTab < tabComponents.value.length ? (props.initialTab) : 0]);
const tabIndex = computed(() => {
    return Math.max(0, tabComponents.value.findIndex(t => t === tab.value))
});

const hasWrite = computed(() => {
    return auth.canAccessPlatformMember(props.member, PermissionLevel.Write)
})

useKeyUpDown({
    up: goBack,
    down: goNext
})

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
                component: markRaw(EditMemberAllBox),
                saveHandler: async ({dismiss}: NavigationActions) => {
                    await dismiss({force: true});
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

async function editMemberResponsibilities() {
    await present({
        components: [
            new ComponentWithProperties(MemberStepView, {
                member: props.member,
                title: 'Functies van ' + props.member.member.firstName,
                component: markRaw(EditMemberResponsibilitiesBox),
                saveHandler: async ({dismiss}: NavigationActions) => {
                    await dismiss({force: true});
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}
async function showContextMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: 'Bewerken',
                icon: 'edit',
                async action() {
                    await editMember()
                },
            }),
            new ContextMenuItem({
                name: 'Functies bewerken',
                icon: 'star',
                async action() {
                    await editMemberResponsibilities()
                },
            })
        ]
    ])

    await menu.show({
        clickEvent: event
    })
}

</script>
