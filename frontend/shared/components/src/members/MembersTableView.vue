<template>
    <LoadingViewTransition>
        <ModernTableView v-if="!loading" ref="modernTableView" :table-object-fetcher="tableObjectFetcher" :filter-builders="filterBuilders" :title="title" :column-configuration-id="configurationId" :default-filter="defaultFilter" :actions="actions" :all-columns="allColumns" :estimated-rows="estimatedRows" :Route="Route">
            <p v-if="isLimitedGroup" class="style-description-block">
                {{ $t('b91c82a6-67c0-451f-867c-8a3468d6381c') }}
            </p>

            <template #empty>
                {{ $t('22f14cbd-ccaf-41a7-a7ca-15272d6203b9') }}
            </template>
        </ModernTableView>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { ComponentExposed, InMemoryTableAction, LoadingViewTransition, ModernTableView, TableAction, useAppContext, useAuth, useChooseOrganizationMembersForGroup, useGlobalEventListener, useOrganization, usePlatform, useRequiredRegistrationsFilter, useTableObjectFetcher } from '@stamhoofd/components';
import { AccessRight, Group, GroupCategoryTree, GroupType, MemberResponsibility, PlatformMember, StamhoofdFilter } from '@stamhoofd/structures';
import { Ref, computed, ref } from 'vue';
import { useMembersObjectFetcher } from '../fetchers/useMembersObjectFetcher';
import { useAdvancedMemberWithRegistrationsBlobUIFilterBuilders } from '../filters/filter-builders/members';
import { useDirectMemberActions } from './classes/MemberActionBuilder';
import { getMemberColumns } from './helpers';
import MemberSegmentedView from './MemberSegmentedView.vue';

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

const { filterBuilders, loading } = useAdvancedMemberWithRegistrationsBlobUIFilterBuilders();

const title = computed(() => {
    if (props.customTitle) {
        return props.customTitle;
    }

    if (props.group) {
        return props.group.settings.name.toString();
    }

    return $t(`fb35c140-e936-4e91-aa92-ef4dfc59fb51`);
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
const filterPeriodId = props.periodId ?? props.group?.periodId ?? organization?.value?.period?.period?.id ?? platform.value.period.id;
const defaultFilter = app === 'admin' && !props.group && !props.customFilter
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
    const periodId = filterPeriodId;

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
    if (props.responsibility) {
        return 'responsibility-' + props.responsibility.id;
    }
    if (props.group && props.group.type === GroupType.EventRegistration) {
        return 'event-registrations';
    }
    if (props.group && props.group.type === GroupType.WaitingList) {
        return 'waitinglist';
    }
    if (organization.value) {
        return 'registrations';
    }
    return 'platform-registrations';
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
        if (organization.value && props.periodId) {
            // Only show members that are registered in the current period AND in this group
            // (avoid showing old members that moved to other groups)
            return {
                registrations: {
                    $elemMatch: {
                        organizationId: organization.value.id,
                        periodId: props.periodId,
                        group: {
                            // Do not show members that are only registered for a waiting list or event
                            type: GroupType.Membership,
                        },
                    },
                },
            };
        }

        if (props.periodId) {
            return {
                registrations: {
                    $elemMatch: {
                        periodId: props.periodId,
                    },
                },
            };
        }
        return null;
    }

    const extra: StamhoofdFilter[] = getRequiredRegistrationsFilter({
        group: props.group ?? undefined,
        periodId: props.periodId ?? undefined,
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
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

const allColumns = getMemberColumns({
    dateRange: props.dateRange,
    group: props.group,
    periodId: props.periodId,
    category: props.category,
    organization: organization.value,
    groups,
    filterPeriodId,
    auth,
    app,
    waitingList: waitingList.value,
    financialRead: financialRead.value,
});

const Route = {
    Component: MemberSegmentedView,
    objectKey: 'member',
    getProperties: () => ({
        group: props.group,
    }),
};

const actionBuilder = useDirectMemberActions({
    groups: props.group ? [props.group] : (props.category ? props.category.getAllGroups() : []),
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

const actions: TableAction<ObjectType>[] = [
    new InMemoryTableAction({
        name: $t(`162644a1-aee8-497b-b837-04abb995047f`),
        icon: 'add',
        priority: 0,
        groupIndex: 1,
        needsSelection: false,
        enabled: canAdd,
        handler: async () => {
            await chooseOrganizationMembersForGroup({
                members: [],
                group: props.group!,
            });
        },
    }),
    ...actionBuilder.getActions({
        selectedOrganizationRegistrationPeriod: organizationRegistrationPeriod.value,
        includeMove: true,
        includeEdit: !excludeEdit,
    }),
];

if ((app !== 'admin' && auth.canManagePayments()) || auth.hasPlatformFullAccess()) {
    actions.push(actionBuilder.getChargeAction());
}
</script>
