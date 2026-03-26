<template>
    <ModernTableView
        ref="modernTableView"
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :title="title"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :prefix-column="allColumns[0]"
        :estimated-rows="estimatedRows"
        :Route="Route"
    >
        <template #empty>
            {{ $t('Geen webshops gevonden') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import type { ComponentExposed } from '@stamhoofd/components/VueGlobalHelper.ts';
import { useWebshopsObjectFetcher } from '@stamhoofd/components/fetchers/useWebshopsObjectFetcher.ts';
import { useGetWebshopUIFilterBuilders } from '@stamhoofd/components/filters/filter-builders/webshops.ts';
import ModernTableView from '@stamhoofd/components/tables/ModernTableView.vue';
import { Column } from '@stamhoofd/components/tables/classes/Column.ts';
import type { TableAction } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { InMemoryTableAction } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { useTableObjectFetcher } from '@stamhoofd/components/tables/classes/TableObjectFetcher.ts';
import type { WebshopType, WebshopWithOrganization} from '@stamhoofd/structures';
import { WebshopStatus, appToUri, getWebshopStatusName, getWebshopTypeName } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';
import WebshopView from './WebshopView.vue';

type ObjectType = WebshopWithOrganization;

const title = $t('Webshops');
const estimatedRows = 30;
const configurationId = 'webshops';

const { getWebshopUIFilterBuilders } = useGetWebshopUIFilterBuilders();
const filterBuilders = computed(() => getWebshopUIFilterBuilders());

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;

const objectFetcher = useWebshopsObjectFetcher();
const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

function getWebshopStatusStyle(status: WebshopStatus): string {
    switch (status) {
        case WebshopStatus.Open: return 'success';
        case WebshopStatus.Closed: return 'error';
        case WebshopStatus.Archived: return 'gray';
        default: return '';
    }
}

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string>({
        id: 'name',
        name: $t('Naam'),
        getValue: item => item.webshop.meta.name,
        minimumWidth: 100,
        recommendedWidth: 250,
        grow: true,
    }),

    new Column<ObjectType, string>({
        id: 'organization',
        name: $t('Organisatie'),
        getValue: item => item.organization.name,
        minimumWidth: 100,
        recommendedWidth: 200,
        grow: true,
    }),

    new Column<ObjectType, Date>({
        id: 'createdAt',
        name: $t('Aangemaakt op'),
        allowSorting: false,
        getValue: item => item.webshop.createdAt,
        format: (v, width) => width < 200 ? Formatter.dateNumber(v, true) : Formatter.date(v, true),
        minimumWidth: 80,
        recommendedWidth: 160,
    }),

    new Column<ObjectType, WebshopType>({
        id: 'type',
        name: $t('Type'),
        allowSorting: false,
        getValue: item => item.webshop.meta.type,
        format: type => getWebshopTypeName(type),
        minimumWidth: 80,
        recommendedWidth: 160,
    }),

    new Column<ObjectType, WebshopStatus>({
        id: 'status',
        name: $t('Status'),
        allowSorting: false,
        getValue: item => item.webshop.meta.status,
        format: status => getWebshopStatusName(status),
        getStyle: status => getWebshopStatusStyle(status),
        minimumWidth: 80,
        recommendedWidth: 120,
    }),
];

const Route = {
    Component: WebshopView,
    objectKey: 'webshopWithOrganization',
};

const actions: TableAction<ObjectType>[] = [
    new InMemoryTableAction({
        name: $t('Webshop openen'),
        icon: 'external',
        priority: 10,
        groupIndex: 2,
        needsSelection: true,
        singleSelection: true,
        allowAutoSelectAll: false,
        handler: (items: ObjectType[]) => {
            const item = items[0];
            if (!item) {
                return;
            }
            window.open(item.url, '_blank');
        },
    }),

    new InMemoryTableAction({
        name: $t('Beheer'),
        icon: 'settings',
        priority: 11,
        groupIndex: 2,
        needsSelection: true,
        singleSelection: true,
        allowAutoSelectAll: false,
        handler: (items: ObjectType[]) => {
            const item = items[0];
            if (!item) {
                return;
            }
            const base = '/' + appToUri('dashboard') + '/' + item.organization.uri + '/verkoop';
            // Archived webshops are filtered out of visibleWebshops in dashboard routing,
            // so link to the webshops list instead of the specific webshop page.
            const url = item.webshop.meta.status === WebshopStatus.Archived
                ? base
                : base + '/' + Formatter.slug(item.webshop.id);
            window.open(url, '_blank');
        },
    }),
];
</script>
