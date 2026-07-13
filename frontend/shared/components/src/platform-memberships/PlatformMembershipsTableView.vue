<template>
    <ModernTableView
        ref="modernTableView"
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :title="title"
        :column-configuration-id="configurationId"
        :default-filter="defaultFilter"
        :actions="actions"
        :all-columns="allColumns"
        :default-sort-column="defaultSortColumn"
        :default-sort-direction="defaultSortDirection"
        :route
    >
        <template #empty>
            {{ $t('%1OS') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { useGlobalEventListener } from '#hooks/useGlobalEventListener.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import type { TableAction } from '#tables/classes/TableAction.ts';
import { useTableObjectFetcher } from '#tables/classes/TableObjectFetcher.ts';
import ModernTableView from '#tables/ModernTableView.vue';
import type { PlatformMembership, StamhoofdFilter } from '@stamhoofd/structures';
import { SortItemDirection } from '@stamhoofd/structures';
import { computed } from 'vue';
import { usePlatformMemberhipsObjectFetcher } from '../fetchers/usePlatformMembershipsObjectFetcher';
import { useGetPlatformMembershipsUIFilterBuilders } from '../filters/filter-builders/platform-memberships';
import { usePlatformMembershipActions } from './classes/PlatformMembershipActionBuilder';
import { useGetPlatformMembershipColumns } from './classes/PlatformMembershipColumns';

type ObjectType = PlatformMembership;

const props = withDefaults(
    defineProps<{
        periodId?: string | null;
        customFilter?: StamhoofdFilter | null;
        customTitle?: string | null;
    }>(), {
        periodId: null,
        customFilter: null,
        customTitle: null,
    },
);

const { getWebshopUIFilterBuilders } = useGetPlatformMembershipsUIFilterBuilders();
const filterBuilders = computed(() => getWebshopUIFilterBuilders());

const title = props.customTitle ?? $t('%1Nt');

const platform = usePlatform();

const defaultFilter: StamhoofdFilter = {
    periodId: {
        $: '$rel',
        value: platform.value.period.id,
        name: platform.value.period.name,
    },
};

useGlobalEventListener('members-deleted', async () => {
    tableObjectFetcher.reset(true, true);
});
useGlobalEventListener('members-registered', async () => {
    tableObjectFetcher.reset(true, true);
});

const configurationId = 'platform-memberships';

const objectFetcher = usePlatformMemberhipsObjectFetcher();

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

const allColumns = useGetPlatformMembershipColumns();

const defaultSortColumn = allColumns.find(c => c.id === 'createdAt') ?? null;
const defaultSortDirection = defaultSortColumn ? SortItemDirection.DESC : null;

const actionBuilder = usePlatformMembershipActions();

const actions: TableAction<ObjectType>[] = actionBuilder.getActions();

const route = {
    component: async () => (await import('./PlatformMembershipView.vue')).default,
    objectKey: 'platformMembership',
    getProperties: (object: ObjectType) => {
        return {
            platformMembership: object,
        };
    },
};
</script>
