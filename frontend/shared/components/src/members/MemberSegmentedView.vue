<template>
    <div class="st-view member-segmented-view">
        <STNavigationBar :title="member.member.details.name">
            <template #right>
                <button v-if="hasWrite" v-tooltip="$t('%XO')" class="button icon edit" type="button" @click="editThisMember" />
                <button v-if="hasPrevious || hasNext" type="button" class="button icon arrow-up" :disabled="!hasPrevious" :v-tooltip="$t('%dv')" @click="goBack" />
                <button v-if="hasNext || hasPrevious" type="button" class="button icon arrow-down" :disabled="!hasNext" :v-tooltip="$t('%dw')" @click="goForward" />
                <button v-long-press="(e: any) => showContextMenu(e)" class="button icon more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ member.member.details.firstName }}</span>
                <span v-if="member.member.details.gender === Gender.Male" v-tooltip="member.member.details.defaultAge >= 18 ? $t('%XK') : $t('%XL')" class="icon male blue icon-spacer" />
                <span v-if="member.member.details.gender === Gender.Female" v-tooltip="member.member.details.defaultAge >= 18 ? $t('%XM') : $t('%XN')" class="icon female pink icon-spacer" />
            </h1>

            <SegmentedView :initial-tab="initialTab" :tabs="tabs" :member="member" @change="currentItem = $event" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useDismiss, usePresent } from '@simonbackx/vue-app-navigation';
import SegmentedView from '#containers/SegmentedView.vue';
import TableActionsContextMenu from '#tables/TableActionsContextMenu.vue';
import type { TableActionSelection } from '#tables/classes/TableAction.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useBackForward } from '#hooks/useBackForward.ts';
import { useGlobalEventListener } from '#hooks/useGlobalEventListener.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import type { Group, PlatformMember, PlatformRegistration } from '@stamhoofd/structures';
import { AccessRight, Gender, LimitedFilteredRequest, PermissionLevel } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useMembersObjectFetcher } from '../fetchers/useMembersObjectFetcher';
import { useMemberActions } from './classes/MemberActionBuilder';
import { useEditMember } from './composables/useEditMember';
import MemberDetailsTab from './tabs/MemberDetailsTab.vue';
import MemberPaymentsTab from './tabs/MemberPaymentsTab.vue';
import MemberPlatformMembershipTab from './tabs/MemberPlatformMembershipTab.vue';

type PropType = {
    initialTab?: number | null;
    group?: Group | null;
} & ({
    member: PlatformMember;
    getNext: (current: PlatformMember) => PlatformMember | null;
    getPrevious: (current: PlatformMember) => PlatformMember | null;
} | {
    registration: PlatformRegistration;
    getNext: (current: PlatformRegistration) => PlatformRegistration | null;
    getPrevious: (current: PlatformRegistration) => PlatformRegistration | null;
});

const props = withDefaults(
    defineProps<PropType>(),
    {
        initialTab: null,
        group: null,
        registration: undefined,
        member: undefined,
    },
);
const member = computed(() => {
    if ('member' in props && props.member) {
        return props.member;
    }
    else if ('registration' in props && props.registration) {
        return props.registration.member;
    }
    throw new Error('Either member or registration prop must be provided');
}); ;
const auth = useAuth();
const dismiss = useDismiss();
const present = usePresent();
const editMember = useEditMember();
const organization = useOrganization();

const tabs = computed(() => {
    const base = [{
        name: $t(`%zM`),
        component: new ComponentWithProperties(MemberDetailsTab),
    }];

    if (STAMHOOFD.userMode === 'platform') {
        base.push({
            name: $t(`%Wq`),
            component: new ComponentWithProperties(MemberPlatformMembershipTab),
        });
    }

    if (organization.value && auth.hasAccessRight(AccessRight.MemberReadFinancialData)) {
        base.push({
            name: $t(`%zN`),
            component: new ComponentWithProperties(MemberPaymentsTab),
        });
    }

    return base;
});
const currentItem = tabs.value[0];

const tabIndex = computed(() => {
    return Math.max(0, tabs.value.findIndex(t => t.name === currentItem.name));
});

const hasWrite = computed(() => {
    return auth.canAccessPlatformMember(member.value, PermissionLevel.Write);
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const { hasNext, hasPrevious, goBack, goForward } = useBackForward<PlatformMember | PlatformRegistration, 'member' | 'registration', PropType>('member' in props && props.member ? 'member' : 'registration', props as unknown as any, computed(() => {
    return { initialTab: tabIndex.value };
}));

const buildActions = useMemberActions();
const objectFetcher = useMembersObjectFetcher();

async function showContextMenu(event: MouseEvent) {
    const builder = buildActions({
        organizations: member.value.organizations,
        groups: member.value.filterGroups({ currentPeriod: true, includePending: false }),
        forceWriteAccess: hasWrite.value,
    });

    const actions = builder.getActions({ includeMove: false, includeEdit: true });

    const el = event.currentTarget! as HTMLElement;
    const bounds = el.getBoundingClientRect();

    const selection: TableActionSelection<PlatformMember> = {
        filter: new LimitedFilteredRequest({
            filter: {
                id: member.value.id,
            },
            limit: 2,
        }),
        fetcher: objectFetcher, // todo
        markedRows: new Map([[member.value.id, member.value]]),
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
    await editMember(member.value);
}

useGlobalEventListener('members-deleted', async (members) => {
    if (Array.isArray(members)) {
        for (const member of members) {
            if (member !== null && typeof member === 'object' && member.id === member.value.id) {
                await dismiss({ force: true });
                return;
            }
        }
    }
});

</script>
