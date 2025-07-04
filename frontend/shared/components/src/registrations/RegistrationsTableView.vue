<template>
    <LoadingViewTransition>
        <ModernTableView v-if="!loading" ref="modernTableView" :table-object-fetcher="tableObjectFetcher" :filter-builders="filterBuilders" :title="title" :column-configuration-id="configurationId" :default-filter="defaultFilter" :actions="actions" :all-columns="allColumns" :estimated-rows="estimatedRows" :Route="Route" :default-sort-column="defaultSortColumn" :default-sort-direction="defaultSortDirection">
            <template #empty>
                {{ $t('6b029bcd-5605-42c5-a5db-38f40ab70214') }}
            </template>
        </ModernTableView>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { Column, ComponentExposed, InMemoryTableAction, LoadingViewTransition, ModernTableView, TableAction, useAppContext, useAuth, useChooseOrganizationMembersForGroup, useGlobalEventListener, usePlatform, useTableObjectFetcher } from '@stamhoofd/components';
import { AccessRight, Group, GroupCategoryTree, GroupType, MemberResponsibility, Organization, PlatformRegistration, SortItemDirection, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, Ref, ref } from 'vue';
import { useRegistrationsObjectFetcher } from '../fetchers/useRegistrationsObjectFetcher';
import { useAdvancedRegistrationWithMemberUIFilterBuilders } from '../filters/filter-builders/registrations-with-member';
import { getRegistrationColumns } from '../members/helpers/getRegistrationColumns';
import RegistrationSegmentedView from './RegistrationSegmentedView.vue';
import { useDirectRegistrationActions } from './classes/RegistrationActionBuilder';

type ObjectType = PlatformRegistration;

const props = withDefaults(
    defineProps<{
        organization?: Organization | null;
        group?: Group | null;
        category?: GroupCategoryTree | null;
        periodId?: string | null;
        responsibility?: MemberResponsibility | null; // for now only for saving column config
        customFilter?: StamhoofdFilter | null;
        customTitle?: string | null;
        dateRange?: { start: Date; end: Date } | null;
    }>(), {
        organization: null,
        group: null,
        category: null,
        periodId: null,
        customFilter: null,
        customTitle: null,
        responsibility: null,
        dateRange: null,
    },
);

const waitingList = computed(() => props.group && props.group.type === GroupType.WaitingList);

const { filterBuilders, loading } = useAdvancedRegistrationWithMemberUIFilterBuilders();

const title = computed(() => {
    if (props.customTitle) {
        return props.customTitle;
    }

    if (props.group) {
        return props.group.settings.name.toString();
    }

    return $t(`938926c1-cb27-427d-aabd-638c5ec1d14a`);
});

const estimatedRows = computed(() => {
    if (props.group) {
        return props.group.settings.registeredMembers;
    }
    return 30;
});

const app = useAppContext();

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const auth = useAuth();
const platform = usePlatform();
const filterPeriodId = props.periodId ?? props.group?.periodId ?? props.organization?.period?.period?.id ?? platform.value.period.id;

const defaultFilter: StamhoofdFilter = app === 'admin' && !props.group
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

    return props.organization?.periods?.organizationPeriods?.find(p => p.period.id === periodId);
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
    return 'registrations-' + app + '-org-' + (props.organization?.id ?? 'null') + '-' + (props.group ? '-group-' + props.group.id : '') + (props.category ? '-category-' + props.category.id : '') + (props.responsibility ? '-responsibility-' + props.responsibility.id : '');
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

function getRequiredFilter(): StamhoofdFilter | null {
    if (props.customFilter) {
        return props.customFilter;
    }

    if (!props.group && !props.category) {
        if (props.organization && props.periodId) {
            // Only show members that are registered in the current period AND in this group
            // (avoid showing old members that moved to other groups)

            return {
                organizationId: props.organization.id,
                periodId: props.periodId,
                deactivatedAt: null,
            };
        }

        if (props.periodId) {
            return {
                periodId: props.periodId,
                deactivatedAt: null,
            };
        }
        return {
            deactivatedAt: null,
        };
    }

    const extra: StamhoofdFilter[] = [];

    if (props.organization && props.group && props.group.organizationId !== props.organization?.id) {
        // Only show members that are registered in the current period AND in this group
        // (avoid showing old members that moved to other groups)
        const periodIds = [props.group.periodId];
        if (props.periodId) {
            periodIds.push(props.periodId);
        }
        if (props.organization?.period?.period?.id) {
            periodIds.push(props.organization.period.period.id);
        }
        if (platform.value.period.id) {
            periodIds.push(platform.value.period.id);
        }

        extra.push({
            organizationId: props.organization.id,
            periodId: {
                $in: Formatter.uniqueArray(periodIds),
            },
        });
    }

    return [
        props.group
            ? {
                    groupId: props.group.id,
                    deactivatedAt: null,
                }
            : {
                    groupId: {
                        $in: groups.map(g => g.id),
                    },
                    deactivatedAt: null,
                },
        ...extra,
    ];
}

const objectFetcher = useRegistrationsObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = getRegistrationColumns({
    dateRange: props.dateRange,
    group: props.group,
    periodId: props.periodId,
    category: props.category,
    organization: props.organization,
    groups,
    filterPeriodId,
    auth,
    app,
    waitingList: waitingList.value,
    financialRead: financialRead.value,
});

const defaultSortColumn = allColumns.find(c => c.id === 'registeredAt') ?? null;
const defaultSortDirection = defaultSortColumn ? SortItemDirection.DESC : null;

const Route = {
    Component: RegistrationSegmentedView,
    objectKey: 'registration',
    getProperties: () => ({
        group: props.group,
    }),
};

const actionBuilder = useDirectRegistrationActions({
    groups: props.group ? [props.group] : (props.category ? props.category.getAllGroups() : []),
});

const chooseOrganizationMembersForGroup = useChooseOrganizationMembersForGroup();
let canAdd = (props.group ? auth.canRegisterMembersInGroup(props.group) : false);
if (!props.organization) {
    // For now not possible via admin panel
    canAdd = false;
}

// registrations for events of another organization should not be editable
const excludeEdit = props.group && props.group.type === GroupType.EventRegistration && !!props.organization && props.group.organizationId !== props.organization.id;

const registrationActions = actionBuilder.getActions({
    selectedOrganizationRegistrationPeriod: organizationRegistrationPeriod.value,
    includeMove: true,
    includeEdit: !excludeEdit,
});

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
    ...registrationActions,
];
</script>
