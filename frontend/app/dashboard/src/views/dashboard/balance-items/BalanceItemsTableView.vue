<template>
    <ModernTableView
        ref="modernTableView"
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :default-sort-column="allColumns.find(c => c.id === 'createdAt')"
        :default-sort-direction="SortItemDirection.DESC"
        :default-filter="defaultFilter"
        :title="title"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :route
    >
        <template #empty>
            {{ $t('%Lu') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import type { ComponentExposed } from '@stamhoofd/components/VueGlobalHelper.ts';
import { useBalanceItemsFetcher } from '@stamhoofd/components/fetchers/useBalanceItemsObjectFetcher.ts';
import { getBalanceItemsUIFilterBuilders } from '@stamhoofd/components/filters/filterBuilders.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization';
import ModernTableView from '@stamhoofd/components/tables/ModernTableView.vue';
import { Column } from '@stamhoofd/components/tables/classes/Column.ts';
import { AsyncTableAction } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { useTableObjectFetcher } from '@stamhoofd/components/tables/classes/TableObjectFetcher.ts';

import type { BalanceItem, BalanceItemType, StamhoofdFilter } from '@stamhoofd/structures';
import { BalanceItemRelationType, BalanceItemStatus, ExcelExportType, getBalanceItemRelationTypeName, getBalanceItemStatusName, getBalanceItemTypeName, SortItemDirection } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';
import { useSelectableWorkbook } from './getSelectableWorkbook';

const props = withDefaults(
    defineProps<{
        defaultFilter?: StamhoofdFilter | null;
    }>(), {
        defaultFilter: null,
    },
);

type ObjectType = BalanceItem;

const configurationId = computed(() => {
    return 'balance-items';
});

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const filterBuilders = getBalanceItemsUIFilterBuilders();
const organization = useOrganization();
const title = computed(() => {
    return $t('%1LA');
});

function getRequiredFilter(): StamhoofdFilter | null {
    return {
        status: {
            $neq: BalanceItemStatus.Hidden,
        },
    };
}

const objectFetcher = useBalanceItemsFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string>({
        id: 'id',
        name: 'ID',
        getValue: object => object.id.substring(0, 8),
        getStyle: () => 'code',
        minimumWidth: 50,
        recommendedWidth: 50,
        enabled: false,
    }),

    new Column<ObjectType, BalanceItemType>({
        id: 'type',
        name: $t('%1LP'),
        getValue: object => object.type,
        format: val => getBalanceItemTypeName(val),
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'category',
        name: $t('%M2'),
        getValue: object => Formatter.capitalizeFirstLetter(object.category),
        minimumWidth: 100,
        recommendedWidth: 300,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'itemTitle',
        name: $t('%vC'),
        getValue: object => object.itemTitle,
        minimumWidth: 150,
        recommendedWidth: 300,
        enabled: true,
        grow: true,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'itemDescription',
        name: $t('%1LQ'),
        getValue: object => object.itemDescription ?? '',
        format: (val, width) => val || $t('%Rs'),
        getStyle: val => !val ? 'gray' : '',
        minimumWidth: 150,
        recommendedWidth: 300,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'amount',
        name: $t('%M4'),
        getValue: object => object.quantity,
        format: (val, width) => Formatter.integer(val),
        minimumWidth: 50,
        recommendedWidth: 150,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'unitPrice',
        name: $t('%6q'),
        getValue: object => object.unitPrice,
        format: (val, width) => Formatter.price(val),
        getStyle: val => val === 0 ? 'gray' : (val < 0 ? 'negative' : ''),
        minimumWidth: 50,
        recommendedWidth: 150,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'payablePriceWithVAT',
        name: $t('%1IP'),
        getValue: object => object.payablePriceWithVAT,
        format: (val, width) => Formatter.price(val),
        getStyle: val => val === 0 ? 'gray' : (val < 0 ? 'negative' : ''),
        minimumWidth: 50,
        recommendedWidth: 150,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'priceOpen',
        name: $t('%m0'),
        getValue: object => object.priceOpen,
        format: (val, width) => Formatter.price(val),
        getStyle: val => val === 0 ? 'gray' : (val < 0 ? 'negative' : ''),
        minimumWidth: 50,
        recommendedWidth: 150,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'pricePaid',
        name: $t('%Ml'),
        getValue: object => object.pricePaid,
        format: (val, width) => Formatter.price(val),
        getStyle: val => val === 0 ? 'gray' : (val < 0 ? 'negative' : ''),
        minimumWidth: 50,
        recommendedWidth: 150,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'pricePending',
        name: $t('%1OL'),
        getValue: object => object.pricePending,
        format: (val, width) => Formatter.price(val),
        getStyle: val => val === 0 ? 'gray' : (val < 0 ? 'negative' : ''),
        minimumWidth: 50,
        recommendedWidth: 150,
        enabled: false,
        allowSorting: false,
    }),

    ...(organization.value && organization.value.meta.invoicesEnabled
        ? [
                new Column<ObjectType, number>({
                    id: 'priceInvoiced',
                    name: $t('%1US'),
                    getValue: object => object.priceInvoiced,
                    format: (val, width) => Formatter.price(val),
                    getStyle: val => val === 0 ? 'gray' : (val < 0 ? 'negative' : ''),
                    minimumWidth: 50,
                    recommendedWidth: 150,
                    enabled: true,
                    allowSorting: false,
                }),
            ]
        : []),

    ...[...Object.values(BalanceItemRelationType)].map((type) => {
        return new Column<ObjectType, string>({
            id: `balanceItem.relations.${type}`,
            name: getBalanceItemRelationTypeName(type),
            getValue: object => object.relations.get(type)?.name?.toString() || '',
            format: (val, width) => val || $t('%Rs'),
            getStyle: val => !val ? 'gray' : '',
            minimumWidth: 150,
            recommendedWidth: 300,
            enabled: false,
            allowSorting: false,
        });
    }),

    new Column<ObjectType, string>({
        id: 'description',
        name: $t('%6o'),
        getValue: object => object.description,
        minimumWidth: 100,
        recommendedWidth: 300,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, BalanceItemStatus>({
        id: 'status',
        name: $t('%1JM'),
        getValue: object => object.status,
        format: val => getBalanceItemStatusName(val),
        getStyle: (val) => {
            if (val === BalanceItemStatus.Hidden) {
                return 'gray';
            }
            if (val === BalanceItemStatus.Canceled) {
                return 'error';
            }
            return '';
        },
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: false,
    }),

    new Column<ObjectType, Date>({
        id: 'createdAt',
        name: $t('%1JJ'),
        getValue: object => object.createdAt,
        format: (v, width) => width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true)),
        minimumWidth: 120,
        recommendedWidth: 160,
    }),
];

const route = {
    component: async () => (await import('@stamhoofd/components/payments/EditBalanceItemView.vue')).default,
    objectKey: 'balanceItem',
    getProperties: (balanceItem: BalanceItem) => {
        return {
            isNew: false,
            balanceItem,
        };
    },
};

const present = usePresent();
const { getSelectableWorkbook } = useSelectableWorkbook();
const actions = [
    new AsyncTableAction({
        name: $t('%V8'),
        icon: 'download',
        priority: 0,
        groupIndex: 2,
        needsSelection: true,
        allowAutoSelectAll: true,
        handler: async (selection) => {
            await present({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: AsyncComponent(() => import('@stamhoofd/frontend-excel-export/ExcelExportView.vue'), {
                            type: ExcelExportType.BalanceItems,
                            filter: selection.filter,
                            workbook: getSelectableWorkbook(),
                            configurationId: configurationId.value,
                            title: [organization.value?.name, $t('%1LA')].filter(Boolean).join(' - '),
                        }),
                    }),
                ],
                modalDisplayStyle: 'popup',
            });
        },
    }),
];
</script>
