<template>
    <LoadingViewTransition>
        <ModernTableView v-if="!loading" ref="modernTableView" :table-object-fetcher="tableObjectFetcher" :filter-builders="filterBuilders" :title="title" :column-configuration-id="configurationId" :default-filter="defaultFilter" :actions="actions" :all-columns="allColumns" :default-sort-column="defaultSortColumn" :default-sort-direction="defaultSortDirection">
            <template #empty>
                {{ $t('Geen aansluitingen') }}
            </template>
        </ModernTableView>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import LoadingViewTransition from '#containers/LoadingViewTransition.vue';
import { useGlobalEventListener } from '#hooks/useGlobalEventListener.ts';
import ModernTableView from '#tables/ModernTableView.vue';
import { Column } from '#tables/classes/Column.ts';
import type { TableAction } from '#tables/classes/TableAction.ts';
import { useTableObjectFetcher } from '#tables/classes/TableObjectFetcher.ts';
import type { PlatformMembership, StamhoofdFilter } from '@stamhoofd/structures';
import { SortItemDirection } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { Formatter } from '../../../../../shared/utility/dist/Formatter';
import { usePlatformMemberhipsObjectFetcher } from '../fetchers/usePlatformMembershipsObjectFetcher';
import { useGetPlatformMembershipsUIFilterBuilders } from '../filters/filter-builders/platform-memberships';
import { usePlatform } from '../hooks/usePlatform';
import { usePlatformMembershipActions } from './classes/PlatformMembershipActionBuilder';

type ObjectType = PlatformMembership;

const { getWebshopUIFilterBuilders } = useGetPlatformMembershipsUIFilterBuilders();

const loading = ref(false);
const filterBuilders = computed(() => getWebshopUIFilterBuilders());

const title = $t('Aansluitingen');

// const app = useAppContext();
// const organizationScope = useOrganization();

// const auth = useAuth();
const platform = usePlatform();
// const filterPeriodId = platform.value.period.id;

const defaultFilter: StamhoofdFilter = getDefaultFilter();

function getDefaultFilter(): StamhoofdFilter {
    // if (app === 'admin') {
    //     if (props.group) {
    //         return null;
    //     }
    //     else {
    //         let filter: StamhoofdFilter = {
    //             group: {
    //                 $elemMatch: {
    //                     $not: {
    //                         defaultAgeGroupId: {
    //                             $in: [null],
    //                         },
    //                     },
    //                 },
    //             },

    //         };

    //         if (!props.periodId && !props.group) {
    //             filter = mergeFilters([
    //                 filter,
    //                 { periodId: filterPeriodId },
    //             ]);
    //         }
    //         else {
    //             filter = mergeFilters([
    //                 filter,
    //                 { member: {
    //                     $elemMatch: {
    //                         platformMemberships: {
    //                             $elemMatch: {
    //                                 endDate: {
    //                                     $gt: { $: '$now' },
    //                                 },
    //                             },
    //                         },
    //                     },
    //                 } },
    //             ]);
    //         }

    //         return filter;
    //     };
    // }

    return null;
}

useGlobalEventListener('members-deleted', async () => {
    tableObjectFetcher.reset(true, true);
});
useGlobalEventListener('members-registered', async () => {
    tableObjectFetcher.reset(true, true);
});

const configurationId = 'platform-memberships';

// const financialRead = computed(() => auth.permissions?.hasAccessRight(AccessRight.MemberReadFinancialData) ?? false);

// const { getRequiredRegistrationsFilter } = useRequiredRegistrationsFilter();

function getRequiredFilter(): StamhoofdFilter | null {
    // if (props.customFilter) {
    //     return props.customFilter;
    // }

    // if (!props.group && !props.category) {
    //     if (props.organization && props.periodId) {
    //         // Only show members that are registered in the current period AND in this group
    //         // (avoid showing old members that moved to other groups)

    //         return {
    //             organizationId: props.organization.id,
    //             periodId: props.periodId,
    //             deactivatedAt: null,
    //             group: {
    //                 $elemMatch: {
    //                     deletedAt: null,
    //                 },

    //             },
    //         };
    //     }

    //     if (props.periodId) {
    //         return {
    //             periodId: props.periodId,
    //             deactivatedAt: null,
    //             group: {
    //                 $elemMatch: {
    //                     deletedAt: null,
    //                 },

    //             },
    //         };
    //     }
    //     return {
    //         deactivatedAt: null,
    //         group: {
    //             $elemMatch: {
    //                 deletedAt: null,
    //             },

    //         },
    //     };
    // }

    // const extra: StamhoofdFilter[] = getRequiredRegistrationsFilter({
    //     group: props.group ?? undefined,
    //     periodId: props.periodId ?? undefined,
    // }, true);

    // return [
    //     props.group
    //         ? {
    //                 groupId: props.group.id,
    //                 deactivatedAt: null,
    //             }
    //         : {
    //                 groupId: {
    //                     $in: groups.map(g => g.id),
    //                 },
    //                 deactivatedAt: null,
    //                 group: {
    //                     $elemMatch: {
    //                         deletedAt: null,
    //                     },
    //                 },
    //             },
    //     ...extra,
    // ];
    return null;
}

const objectFetcher = usePlatformMemberhipsObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

function getMembershipType(id: string) {
    return platform.value.config.membershipTypes.find(mt => mt.id === id);
}

const now = new Date();
const formatDate = (v: Date, width: number) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`%Gr`);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, PlatformMembership>({
        id: 'id',
        name: $t('Id'),
        getValue: m => m,
        format: m => m.id,
        minimumWidth: 60,
        recommendedWidth: 100,
        index: 0,
    }),
    new Column<ObjectType, string>({
        id: 'member.name',
        name: $t('Naam lid'),
        getValue: m => m.member.name,
        minimumWidth: 100,
        recommendedWidth: 200,
        enabled: true,
        allowSorting: false
    }),
    new Column<ObjectType, string>({
        id: 'member.name',
        name: $t('Lidnummer'),
        getValue: m => m.member.memberNumber ?? '',
        format: val => val ? val : $t(`%1FW`),
        minimumWidth: 100,
        recommendedWidth: 200,
        enabled: true,
        allowSorting: false
    }),
    new Column<ObjectType, string>({
        id: 'organization.name',
        name: $t('Naam vereniging'),
        getValue: m => m.organization.name,
        minimumWidth: 100,
        recommendedWidth: 200,
        enabled: true,
        allowSorting: false
    }),
    new Column<ObjectType, string>({
        id: 'organization.uri',
        name: $t('Nummer vereniging'),
        getValue: m => m.organization.uri,
        minimumWidth: 60,
        recommendedWidth: 100,
        enabled: true,
        allowSorting: false
    }),
    new Column<ObjectType, string>({
        id: 'membershipTypeId',
        name: $t('Type'),
        getValue: m => m.membershipTypeId,
        format: (id) => {
            const type = getMembershipType(id);
            if (type) {
                return type.name;
            }
            return id;
        },
        minimumWidth: 60,
        recommendedWidth: 100,
        enabled: true,
        allowSorting: true
    }),
    new Column<ObjectType, Date>({
        id: 'startDate',
        name: $t('Startdatum'),
        getValue: m => m.startDate,
        format: formatDate,
        minimumWidth: 80,
        recommendedWidth: 200,
        enabled: false,
        allowSorting: true
    }),
    new Column<ObjectType, Date>({
        id: 'endDate',
        name: $t('Einddatum'),
        getValue: m => m.endDate,
        format: formatDate,
        minimumWidth: 80,
        recommendedWidth: 200,
        enabled: false,
        allowSorting: true
    }),
    new Column<ObjectType, number>({
        id: 'price',
        name: $t(`%1IP`),
        allowSorting: true,
        getValue: m => m.price,
        format: (price) => {
            if (price === 0) {
                return $t(`%1Mn`);
            }
            return Formatter.price(price);
        },
        getStyle: v => v === 0 ? 'gray' : (v < 0 ? 'negative' : ''),
        minimumWidth: 70,
        recommendedWidth: 80,
        enabled: false,
    }),
    new Column<ObjectType, Date>({
        id: 'createdAt',
        name: $t('%1Jc'),
        allowSorting: true,
        getValue: (v) => v.createdAt,
        format: formatDate,
        getStyle: v => v === null ? 'gray' : '',
        minimumWidth: 80,
        recommendedWidth: 220,
    }),
    new Column<ObjectType, Date | null>({
        id: 'trialUntil',
        name: $t(`Proefperiode`),
        allowSorting: true,
        getValue: m => m.trialUntil,
        // todo: test
        format: (value, width) => {
            if (!value) {
                return $t('Geen');
            }
            const date = formatDate(value, width);

            if (value > now) {
                return $t('%g8', {date})
            }
            return $t('%16u', {date})
        },
        getStyle: v => v === null ? 'gray' : (v < now ? 'negative' : ''),
        minimumWidth: 70,
        recommendedWidth: 80,
        enabled: false,
    }),
    new Column<ObjectType, number>({
        id: 'freeAmount',
        name: $t('Dagen gratis'),
        allowSorting: true,
        getValue: (v) => v.freeAmount,
        format: v => v ? v.toString() : $t('Geen'),
        getStyle: v => v ?  '' : 'gray',
        minimumWidth: 80,
        recommendedWidth: 220,
    }),
];

const defaultSortColumn = allColumns.find(c => c.id === 'registeredAt') ?? null;
const defaultSortDirection = defaultSortColumn ? SortItemDirection.DESC : null;

const  actionBuilder = usePlatformMembershipActions();

// const chooseOrganizationMembersForGroup = useChooseOrganizationMembersForGroup();
// let canAdd = (props.group ? auth.canRegisterMembersInGroup(props.group) : false);
// if (!organizationScope.value) {
//     // For now not possible via admin panel
//     canAdd = false;
// }

// // registrations for events of another organization should not be editable
// const excludeEdit = props.group && props.group.type === GroupType.EventRegistration && !!props.organization && props.group.organizationId !== props.organization.id;

// const registrationActions = actionBuilder.getActions({
//     selectedOrganizationRegistrationPeriod: organizationRegistrationPeriod.value,
//     includeMove: true,
//     includeEdit: !excludeEdit,
// });

const actions: TableAction<ObjectType>[] = actionBuilder.getActions();
</script>
