<template>
    <div class="st-view member-segmented-view">
        <STNavigationBar :title="member.member.details.name">
            <template #right>
                <button v-if="hasPrevious || hasNext" v-tooltip="'Ga naar vorige lid'" type="button" class="button navigation icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                <button v-if="hasNext || hasPrevious" v-tooltip="'Ga naar volgende lid'" type="button" class="button navigation icon arrow-down" :disabled="!hasNext" @click="goForward" />

                <button v-if="hasWrite" v-tooltip="$t('f2eb0c04-0dca-4c8e-b920-7044a65aee6a')" class="button icon navigation edit" type="button" @click="editThisMember" />
                <button v-long-press="(e) => showContextMenu(e)" class="button icon navigation more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ member.member.details.firstName }}</span>
                <span v-if="member.member.details.gender === Gender.Male" v-tooltip="member.member.details.defaultAge >= 18 ? 'Man' : 'Jongen'" class="icon male blue icon-spacer" />
                <span v-if="member.member.details.gender === Gender.Female" v-tooltip="member.member.details.defaultAge >= 18 ? 'Vrouw' : 'Meisje'" class="icon female pink icon-spacer" />
            </h1>

            <SegmentedControl v-model="tab" :items="tabComponents" :labels="tabLabels" />
            <component :is="tab" :member="member" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useDismiss, usePresent } from '@simonbackx/vue-app-navigation';
import { SegmentedControl, TableActionsContextMenu, TableActionSelection, useAuth, useBackForward, useGlobalEventListener, useOrganization } from '@stamhoofd/components';
import { AccessRight, Gender, Group, LimitedFilteredRequest, PermissionLevel, PlatformMember } from '@stamhoofd/structures';
import { computed, markRaw, ref } from 'vue';
import { useMembersObjectFetcher } from '../fetchers/useMembersObjectFetcher';
import { useMemberActions } from './classes/MemberActionBuilder';
import { useEditMember } from './composables/useEditMember';
import MemberDetailsTab from './tabs/MemberDetailsTab.vue';
import MemberPaymentsTab from './tabs/MemberPaymentsTab.vue';
import MemberPlatformMembershipTab from './tabs/MemberPlatformMembershipTab.vue';

type PropType = {
    member: PlatformMember;
    initialTab?: number | null;
    group?: Group | null;
    getNext: (current: PlatformMember) => PlatformMember | null;
    getPrevious: (current: PlatformMember) => PlatformMember | null;
};

const props = withDefaults(
    defineProps<PropType>(),
    {
        initialTab: null,
        group: null,
    },
);
const auth = useAuth();
const dismiss = useDismiss();
const present = usePresent();
const editMember = useEditMember();
const organization = useOrganization();

const tabs = computed(() => {
    const base: { name: string; component: unknown }[] = [{
        name: 'Gegevens',
        component: markRaw(MemberDetailsTab),
    }];

    if (STAMHOOFD.userMode === 'platform') {
        base.push({
            name: 'Aansluiting',
            component: markRaw(MemberPlatformMembershipTab),
        });
    }

    if (organization.value && auth.hasAccessRight(AccessRight.MemberReadFinancialData)) {
        base.push({
            name: 'Rekening',
            component: markRaw(MemberPaymentsTab),
        });
    }

    return base;
});

const tabComponents = computed(() => {
    return tabs.value.map(t => t.component);
});
const tabLabels = computed(() => {
    return tabs.value.map(t => t.name);
});

const tab = ref(tabComponents.value[props.initialTab && props.initialTab < tabComponents.value.length ? (props.initialTab) : 0]);
const tabIndex = computed(() => {
    return Math.max(0, tabComponents.value.findIndex(t => t === tab.value));
});

const hasWrite = computed(() => {
    return auth.canAccessPlatformMember(props.member, PermissionLevel.Write);
});

const { hasNext, hasPrevious, goBack, goForward } = useBackForward('member', props, computed(() => {
    return { initialTab: tabIndex.value };
}));

const buildActions = useMemberActions();
const objectFetcher = useMembersObjectFetcher();

async function showContextMenu(event: MouseEvent) {
    const builder = buildActions({
        organizations: props.member.organizations,
        groups: props.member.filterGroups({ currentPeriod: true, includePending: false }),
        forceWriteAccess: hasWrite.value,
    });

    const actions = builder.getActions({ includeDelete: true, includeMove: false, includeEdit: true });

    const el = event.currentTarget! as HTMLElement;
    const bounds = el.getBoundingClientRect();

    const selection: TableActionSelection<PlatformMember> = {
        filter: new LimitedFilteredRequest({
            filter: {
                id: props.member.id,
            },
            limit: 2,
        }),
        fetcher: objectFetcher, // todo
        markedRows: new Map([[props.member.id, props.member]]),
        markedRowsAreSelected: true,
    };

    const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
        x: bounds.left,
        y: bounds.bottom,
        xPlacement: 'right',
        yPlacement: 'bottom',
        actions,
        selection,
    });
    await present(displayedComponent.setDisplayStyle('overlay'));
}

async function editThisMember() {
    await editMember(props.member);
}

useGlobalEventListener('members-deleted', async (members) => {
    if (Array.isArray(members)) {
        for (const member of members) {
            if (member !== null && typeof member === 'object' && member.id === props.member.id) {
                await dismiss({ force: true });
                return;
            }
        }
    }
});

</script>
