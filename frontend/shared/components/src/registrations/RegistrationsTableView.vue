<template>
    <LoadingViewTransition>
        <ModernTableView v-if="!isLoading" ref="modernTableView" :table-object-fetcher="tableObjectFetcher" :filter-builders="filterBuilders" :title="title" :column-configuration-id="configurationId" :default-filter="defaultFilter" :actions="actions" :all-columns="allColumns" :estimated-rows="estimatedRows" :Route="Route" :default-sort-column="defaultSortColumn" :default-sort-direction="defaultSortDirection">
            <p v-if="isLimitedGroup" class="style-description-block">
                {{ $t('%1HO') }}
            </p>
            <p v-if="app === 'admin' && !group" class="style-description-block">
                {{ $t('%1GG') }}
            </p>
            <template #empty>
                {{ $t('%173') }}
            </template>
        </ModernTableView>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import type { ComponentExposed } from '#VueGlobalHelper.ts';
import LoadingViewTransition from '#containers/LoadingViewTransition.vue';
import { useAppContext } from '#context/appContext.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useGlobalEventListener } from '#hooks/useGlobalEventListener.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useChooseOrganizationMembersForGroup } from '#members/checkout/useCheckoutRegisterItem.ts';
import { useRequiredRegistrationsFilter } from '#registrations/classes/getRequiredRegistrationsFilter.ts';
import ModernTableView from '#tables/ModernTableView.vue';
import type { Column } from '#tables/classes/Column.ts';
import type { TableAction } from '#tables/classes/TableAction.ts';
import { InMemoryTableAction } from '#tables/classes/TableAction.ts';
import { useTableObjectFetcher } from '#tables/classes/TableObjectFetcher.ts';
import type { Group, GroupCategoryTree, MemberResponsibility, Organization, PlatformRegistration, StamhoofdFilter } from '@stamhoofd/structures';
import { AccessRight, GroupType, mergeFilters, SortItemDirection } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';
import { useRegistrationsObjectFetcher } from '../fetchers/useRegistrationsObjectFetcher';
import { useAdvancedRegistrationWithMemberUIFilterBuilders } from '../filters/filter-builders/registrations-with-member';
import MemberSegmentedView from '../members/MemberSegmentedView.vue';
import { getRegistrationColumns } from '../members/helpers/getRegistrationColumns';
import { useRegistrationInvitationEventListener } from './classes';
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

const { filterBuilders, loading: isLoadingFilters } = useAdvancedRegistrationWithMemberUIFilterBuilders({
    multipleGroups: props.organization === null || props.category !== null,
});

const actions: Ref<TableAction<ObjectType>[]> = ref([]);
const isLoading = computed(() => isLoadingFilters.value && actions.value.length === 0);

const title = computed(() => {
    if (props.customTitle) {
        return props.customTitle;
    }

    if (props.group) {
        return props.group.settings.name.toString();
    }

    return $t(`%1EI`);
});

const estimatedRows = computed(() => {
    if (props.group) {
        return props.group.settings.registeredMembers;
    }
    return 30;
});

const app = useAppContext();
const organizationScope = useOrganization();

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const auth = useAuth();
const platform = usePlatform();
const filterPeriodId = props.periodId ?? props.group?.periodId ?? props.organization?.period?.period?.id ?? platform.value.period.id;

const defaultFilter: StamhoofdFilter = getDefaultFilter();

function getDefaultFilter(): StamhoofdFilter {
    if (app === 'admin') {
        if (props.group) {
            return null;
        }
        else {
            let filter: StamhoofdFilter = {
                group: {
                    $elemMatch: {
                        $not: {
                            defaultAgeGroupId: {
                                $in: [null],
                            },
                        },
                    },
                },

            };

            if (!props.periodId && !props.group) {
                filter = mergeFilters([
                    filter,
                    { periodId: filterPeriodId },
                ]);
            }
            else {
                filter = mergeFilters([
                    filter,
                    { member: {
                        $elemMatch: {
                            platformMemberships: {
                                $elemMatch: {
                                    endDate: {
                                        $gt: { $: '$now' },
                                    },
                                },
                            },
                        },
                    } },
                ]);
            }

            return filter;
        };
    }

    return null;
}

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
    if (props.responsibility) {
        return 'responsibility-' + props.responsibility.id;
    }
    if (props.group && props.group.type === GroupType.EventRegistration) {
        return 'event-registrations';
    }
    if (props.group && props.group.type === GroupType.WaitingList) {
        return 'waitinglist';
    }
    if (props.organization) {
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
        if (props.organization && props.periodId) {
            // Only show members that are registered in the current period AND in this group
            // (avoid showing old members that moved to other groups)

            return {
                organizationId: props.organization.id,
                periodId: props.periodId,
                deactivatedAt: null,
                group: {
                    $elemMatch: {
                        deletedAt: null,
                    },

                },
            };
        }

        if (props.periodId) {
            return {
                periodId: props.periodId,
                deactivatedAt: null,
                group: {
                    $elemMatch: {
                        deletedAt: null,
                    },

                },
            };
        }
        return {
            deactivatedAt: null,
            group: {
                $elemMatch: {
                    deletedAt: null,
                },

            },
        };
    }

    const extra: StamhoofdFilter[] = getRequiredRegistrationsFilter({
        group: props.group ?? undefined,
        periodId: props.periodId ?? undefined,
    }, true);

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
                    group: {
                        $elemMatch: {
                            deletedAt: null,
                        },
                    },
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
    Component: MemberSegmentedView,
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
if (!organizationScope.value) {
    // For now not possible via admin panel
    canAdd = false;
}

// registrations for events of another organization should not be editable
const excludeEdit = props.group && props.group.type === GroupType.EventRegistration && !!props.organization && props.group.organizationId !== props.organization.id;

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
    if (organizationScope.value && props.group.organizationId !== organizationScope.value.id) {
        return true;
    }
    if (!auth.canAccessGroup(props.group)) {
        return true;
    }
    return false;
});

let groupsLinkedToWaitingList: Group[] = [];

async function createActions(): Promise<void> {
    const registrationActions = await actionBuilder.getActions({
        selectedOrganizationRegistrationPeriod: organizationRegistrationPeriod.value,
        includeMove: true,
        includeEdit: !excludeEdit,
    });

    const results: TableAction<ObjectType>[] = [
        new InMemoryTableAction({
                name: $t(`%zh`),
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

    if ((app !== 'admin' && auth.canManagePayments()) || auth.hasPlatformFullAccess()) {
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
    })
}
</script>
