<template>
    <LoadingViewTransition :loading="isLoading">
        <ModernTableView
            v-if="!isLoading"
            :key="filterPeriodId"
            ref="modernTableView"
            :table-object-fetcher="tableObjectFetcher"
            :filter-builders="filterBuilders"
            :title="title"
            :column-configuration-id="configurationId"
            :default-filter="defaultFilter"
            :actions="actions"
            :all-columns="allColumns"
            :estimated-rows="estimatedRows"
            :route
        >
            <p v-if="isLimitedGroup" class="style-description-block">
                {{ $t('%1HO') }}
            </p>

            <p v-if="sgvSyncWarning" :class="sgvSyncWarning.status === SGVSyncStatus.Never ? 'error-box icon sync' : 'info-box icon sync'" @click="sgvSyncOpen">
                {{ sgvSyncWarning.text }}
                <button v-if="auth.hasFullAccess()" class="button text" type="button">
                    {{ $t('%1XD') }}
                </button>
            </p>

            <template #empty>
                {{ $t('%e3') }}
            </template>
        </ModernTableView>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import LoadingViewTransition from '#containers/LoadingViewTransition.vue';
import { useAppContext } from '#context/appContext.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useGlobalEventListener } from '#hooks/useGlobalEventListener.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useChooseOrganizationMembersForGroup } from '#members/checkout/useCheckoutRegisterItem.ts';
import { getMemberColumns } from '#members/helpers/getMemberColumns.ts';
import { useRequiredRegistrationsFilter } from '#registrations/classes/getRequiredRegistrationsFilter.ts';
import { useRegistrationInvitationEventListener } from '#registrations/classes/useRegistrationInvitationEventListener.ts';
import type { TableAction } from '#tables/classes/TableAction.ts';
import { InMemoryTableAction } from '#tables/classes/TableAction.ts';
import { useTableObjectFetcher } from '#tables/classes/TableObjectFetcher.ts';
import ModernTableView from '#tables/ModernTableView.vue';
import type { ComponentExposed } from '#VueGlobalHelper.ts';
import { useSGVSync } from '@stamhoofd/sgv-frontend/useSGVSync';
import type { Group, GroupCategoryTree, MemberResponsibility, PlatformMember, StamhoofdFilter } from '@stamhoofd/structures';
import { AccessRight, GroupType, SGVSyncStatus } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';
import { useMembersObjectFetcher } from '../fetchers/useMembersObjectFetcher';
import { useAdvancedMemberWithRegistrationsBlobUIFilterBuilders } from '../filters/filter-builders/members';
import { useDirectMemberActions } from './classes/MemberActionBuilder';

type ObjectType = PlatformMember;

const props = withDefaults(
    defineProps<{
        group?: Group | null;
        category?: GroupCategoryTree | null;
        periodId?: string | null;
        responsibility?: MemberResponsibility | null; // for now only for saving column config
        customFilter?: StamhoofdFilter | null;
        customTitle?: string | null;
        dateRange?: { start: Date; end: Date } | null;
        customEstimatedRows?: number | null;
    }>(), {
        group: null,
        category: null,
        periodId: null,
        customFilter: null,
        customTitle: null,
        responsibility: null,
        dateRange: null,
        customEstimatedRows: null,
    },
);

const waitingList = computed(() => props.group && props.group.type === GroupType.WaitingList);

const { filterBuilders, loading: isLoadingFilters } = useAdvancedMemberWithRegistrationsBlobUIFilterBuilders();
const actions: Ref<TableAction<ObjectType>[]> = ref([]);
const isLoading = computed(() => isLoadingFilters.value && actions.value.length === 0);

const title = computed(() => {
    if (props.customTitle) {
        return props.customTitle;
    }

    if (props.group) {
        return props.group.settings.name.toString();
    }

    if (props.category) {
        return props.category.settings.name;
    }

    return $t(`%L8`);
});

const estimatedRows = computed(() => {
    if (props.group) {
        return props.group.settings.registeredMembers;
    }
    return props.customEstimatedRows ?? 30;
});

const app = useAppContext();

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const auth = useAuth();
const organization = useOrganization();
const platform = usePlatform();
const filterPeriodId = computed(() => props.periodId ?? props.group?.periodId ?? organization?.value?.period?.period?.id ?? platform.value.period.id);
const isPlatform = STAMHOOFD.userMode === 'platform';
const defaultFilter = isPlatform && app === 'admin' && !props.group && !props.customFilter
    ? {
            platformMemberships: {
                $elemMatch: {
                    endDate: {
                        $gt: { $: '$now' },
                    },
                },
            },
        }
    : null;

const organizationRegistrationPeriod = computed(() => {
    const periodId = filterPeriodId.value;

    return organization.value?.periods?.organizationPeriods?.find(p => p.period.id === periodId);
});

useGlobalEventListener('members-deleted', async () => {
    tableObjectFetcher.reset(true, true);
});
useGlobalEventListener('members-added', async () => {
    tableObjectFetcher.reset(true, true);
});
useGlobalEventListener('members-registered', async () => {
    tableObjectFetcher.reset(true, true);
});
useGlobalEventListener('paymentPatch', async () => {
    tableObjectFetcher.reset(true, true);
});

const configurationId = computed(() => {
    // Note, this key cannot be the same key as the key returned by the registrations table.
    // The column id's are not the same, so the storage is incomatible.

    if (props.responsibility) {
        return 'members-responsibility-' + props.responsibility.id;
    }
    if (props.group && props.group.type === GroupType.EventRegistration) {
        return 'members-event-registrations';
    }
    if (props.group && props.group.type === GroupType.WaitingList) {
        return 'members-waitinglist';
    }
    if (organization.value) {
        return 'members-registrations';
    }
    return 'members-platform-registrations';
});

const financialRead = computed(() => auth.permissions?.hasAccessRight(AccessRight.MemberReadFinancialData) ?? false);

const groups = (() => {
    if (props.group) {
        return [props.group];
    }
    if (props.category) {
        return props.category.getAllGroups();
    }
    return [];
})();

const { getRequiredRegistrationsFilter } = useRequiredRegistrationsFilter();
function getRequiredFilter(): StamhoofdFilter | null {
    if (props.customFilter) {
        return props.customFilter;
    }

    if (!props.group && !props.category) {
        const periodId = filterPeriodId.value;

        if (organization.value && periodId) {
            // Only show members that are registered in the current period AND in this group
            // (avoid showing old members that moved to other groups)
            return {
                registrations: {
                    $elemMatch: {
                        organizationId: organization.value.id,
                        periodId,
                        group: {
                            // Do not show members that are only registered for a waiting list or event
                            type: GroupType.Membership,
                        },
                    },
                },
            };
        }

        if (periodId) {
            return {
                registrations: {
                    $elemMatch: {
                        periodId,
                    },
                },
            };
        }
        return null;
    }

    const extra: StamhoofdFilter[] = getRequiredRegistrationsFilter({
        group: props.group ?? undefined,
        periodId: filterPeriodId.value,
    });

    return [
        {
            registrations: {
                $elemMatch: props.group
                    ? {
                            groupId: props.group.id,
                        }
                    : {
                            groupId: {
                                $in: groups.map(g => g.id),
                            },
                        },
            },
        },
        ...extra,
    ];
}

const objectFetcher = useMembersObjectFetcher({
    get requiredFilter() {
        return getRequiredFilter();
    },
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);
watch(filterPeriodId, () => {
    tableObjectFetcher.reset(true, true);
});
const { sgvSyncOpen, sgvSyncWarning } = useSGVSync(computed(() => tableObjectFetcher.objects.map(member => member.member)));

const allColumns = getMemberColumns({
    dateRange: props.dateRange,
    group: props.group,
    periodId: props.periodId,
    category: props.category,
    organization: organization.value,
    groups,
    filterPeriodId: filterPeriodId.value,
    auth,
    app,
    waitingList: waitingList.value,
    financialRead: financialRead.value,
});

const route = {
    component: async () => (await import('./MemberSegmentedView.vue')).default,
    objectKey: 'member',
    getProperties: () => ({
        group: props.group,
    }),
};

const actionBuilder = useDirectMemberActions({
    groups: props.group ? [props.group] : (props.category ? props.category.getAllGroups() : []),
    categories: props.category ? [props.category] : [],
});

const isLimitedGroup = computed(() => {
    if (!props.group) {
        return false;
    }

    if (props.group.settings.registeredMembers !== null && tableObjectFetcher.totalCount !== null && props.group.settings.registeredMembers === tableObjectFetcher.totalCount) {
        return false;
    }

    if (app === 'admin') {
        return false;
    }
    if (organization.value && props.group.organizationId !== organization.value.id) {
        return true;
    }
    if (!auth.canAccessGroup(props.group)) {
        return true;
    }
    return false;
});

const chooseOrganizationMembersForGroup = useChooseOrganizationMembersForGroup();
let canAdd = (props.group ? auth.canRegisterMembersInGroup(props.group) : false);
if (!organization.value) {
    // For now not possible via admin panel
    canAdd = false;
}

// registrations for events of another organization should not be editable
const excludeEdit = props.group && props.group.type === GroupType.EventRegistration && !!organization.value && props.group.organizationId !== organization.value.id;

let groupsLinkedToWaitingList: Group[] = [];

async function createActions(): Promise<void> {
    const results: TableAction<ObjectType>[] = [
        new InMemoryTableAction({
            name: $t(`%zh`),
            icon: 'add',
            priority: 0,
            groupIndex: 1,
            needsSelection: false,
            enabled: () => canAdd,
            handler: async () => {
                await chooseOrganizationMembersForGroup({
                    members: [],
                    group: props.group!,
                });
            },
        }),
        ...await actionBuilder.getActions({
            selectedOrganizationRegistrationPeriod: organizationRegistrationPeriod.value,
            includeMove: true,
            includeEdit: !excludeEdit,
            includeOnlyIfRelevantForWaitingList: true,
        }),
    ];

    if (((app !== 'admin' && auth.canManagePayments()) || auth.hasPlatformFullAccess()) && props.group?.type !== GroupType.WaitingList) {
        results.push(actionBuilder.getChargeAction());
    }

    groupsLinkedToWaitingList = actionBuilder.allGroupsLinkedToWaitingList;

    actions.value = results;
}

createActions().catch(console.error);

if (waitingList.value) {
    useRegistrationInvitationEventListener('updated', async (value) => {
        // not necessary in this case because the invitations are updated directly
        if (value.origin === 'members-table-sync') {
            return;
        }

        if (groupsLinkedToWaitingList.some(group => value.groupIds.has(group.id))) {
            tableObjectFetcher.reset(true, true);
        }
    });
}
</script>
