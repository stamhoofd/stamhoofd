<template>
    <ModernTableView ref="modernTableView" :table-object-fetcher="tableObjectFetcher" :filter-builders="filterBuilders" :default-sort-column="allColumns.find(c => c.id === 'createdAt')" :default-sort-direction="SortItemDirection.DESC" :default-filter="defaultFilter" :title="title" :column-configuration-id="configurationId" :actions="actions" :all-columns="allColumns" :Route="Route">
        <template #empty>
            {{ $t('763f791b-dd8d-4cb2-aa57-3d93f33a7c8e') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncTableAction, Column, ComponentExposed, EditBalanceItemView, getBalanceItemsUIFilterBuilders, GlobalEventBus, ModernTableView, useBalanceItemsFetcher, useContext, useTableObjectFetcher } from '@stamhoofd/components';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import { BalanceItem, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, ExcelExportType, getBalanceItemRelationTypeName, getBalanceItemStatusName, getBalanceItemTypeName, SortItemDirection, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, Ref } from 'vue';
import { useSelectableWorkbook } from './getSelectableWorkbook';
import { BalanceItemWithPayments } from '@stamhoofd/structures';
import { AutoEncoderPatchType, PatchableArrayAutoEncoder, PatchableArray, ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';

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
const title = computed(() => {
    return $t('fbe6e4c4-8d98-41b5-b839-11d469031002');
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
        name: $t('23671282-34da-4da9-8afd-503811621055'),
        getValue: object => object.type,
        format: val => getBalanceItemTypeName(val),
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'category',
        name: $t('c178055f-e24d-4fbf-b95c-3f447721da62'),
        getValue: object => Formatter.capitalizeFirstLetter(object.category),
        minimumWidth: 100,
        recommendedWidth: 300,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'itemTitle',
        name: $t('55316f2c-4958-45fe-a57b-4fdb9c3a30bb'),
        getValue: object => object.itemTitle,
        minimumWidth: 150,
        recommendedWidth: 300,
        enabled: true,
        grow: true,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'itemDescription',
        name: $t('936808bb-97a7-4834-8959-468bbf0610bf'),
        getValue: object => object.itemDescription ?? '',
        format: (val, width) => val || $t('6fa11f7a-dbd1-4da1-ac9b-c18a23606df1'),
        getStyle: val => !val ? 'gray' : '',
        minimumWidth: 150,
        recommendedWidth: 300,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'amount',
        name: $t('6d6cce57-34e9-4d38-9bbe-d59692f22803'),
        getValue: object => object.quantity,
        format: (val, width) => Formatter.integer(val),
        minimumWidth: 50,
        recommendedWidth: 150,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'unitPrice',
        name: $t('ac719e97-a593-41c0-b92a-3db36792c56d'),
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
        name: $t('bf33f977-98e6-4c00-b4ad-f95e816011d3'),
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
        name: $t('424a738b-6dd6-4200-bf6e-2517f6ef7c1f'),
        getValue: object => object.priceOpen,
        format: (val, width) => Formatter.price(val),
        getStyle: val => val === 0 ? 'gray' : (val < 0 ? 'negative' : ''),
        minimumWidth: 50,
        recommendedWidth: 150,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'pricePaid',
        name: $t('a314660b-0163-44f2-b329-72f8595d3c69'),
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
        name: $t('e138c55d-ae66-4be3-ae15-497663ac7fa7'),
        getValue: object => object.pricePending,
        format: (val, width) => Formatter.price(val),
        getStyle: val => val === 0 ? 'gray' : (val < 0 ? 'negative' : ''),
        minimumWidth: 50,
        recommendedWidth: 150,
        enabled: false,
        allowSorting: false,
    }),

    ...[...Object.values(BalanceItemRelationType)].map((type) => {
        return new Column<ObjectType, string>({
            id: `balanceItem.relations.${type}`,
            name: getBalanceItemRelationTypeName(type),
            getValue: object => object.relations.get(type)?.name?.toString() || '',
            format: (val, width) => val || $t('6fa11f7a-dbd1-4da1-ac9b-c18a23606df1'),
            getStyle: val => !val ? 'gray' : '',
            minimumWidth: 150,
            recommendedWidth: 300,
            enabled: false,
            allowSorting: false,
        });
    }),

    new Column<ObjectType, string>({
        id: 'description',
        name: $t('d151ed17-b421-4e50-9a6e-db3a09a540d3'),
        getValue: object => object.description,
        minimumWidth: 100,
        recommendedWidth: 300,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, BalanceItemStatus>({
        id: 'status',
        name: $t('f80993dd-16ac-48d6-8be7-09cec1206f8d'),
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
        name: $t('10fd24bb-43dd-4174-9a23-db3ac54af9be'),
        getValue: object => object.createdAt,
        format: (value, width) => width < 150 ? Formatter.dateNumber(value) : Formatter.date(value, true),
        minimumWidth: 120,
        recommendedWidth: 160,
    }),
];

const context = useContext();

const Route = {
    Component: EditBalanceItemView,
    objectKey: 'balanceItem',
    getProperties: (balanceItem: BalanceItem) => {
        return {
            isNew: false,
            saveHandler: async (patch: AutoEncoderPatchType<BalanceItemWithPayments>) => {
                const arr: PatchableArrayAutoEncoder<BalanceItemWithPayments> = new PatchableArray();
                patch.id = balanceItem.id;
                arr.addPatch(patch);
                const result = await context.value.authenticatedServer.request({
                    method: 'PATCH',
                    path: '/organization/balance',
                    body: arr,
                    decoder: new ArrayDecoder(BalanceItemWithPayments as Decoder<BalanceItemWithPayments>),
                    shouldRetry: false,
                });
                if (result.data && result.data.length === 1 && result.data[0].id === balanceItem.id) {
                    balanceItem.deepSet(result.data[0]);
                }
                else {
                    GlobalEventBus.sendEvent('balanceItemPatch', balanceItem.patch(patch)).catch(console.error);
                }
            },
        };
    },
};

const present = usePresent();
const { getSelectableWorkbook } = useSelectableWorkbook();
const actions = [
    new AsyncTableAction({
        name: $t('f97a138d-13eb-4e33-aee3-489d9787b2c8'),
        icon: 'download',
        priority: 0,
        groupIndex: 2,
        needsSelection: true,
        allowAutoSelectAll: true,
        handler: async (selection) => {
            await present({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: new ComponentWithProperties(ExcelExportView, {
                            type: ExcelExportType.BalanceItems,
                            filter: selection.filter,
                            workbook: getSelectableWorkbook(),
                            configurationId: configurationId.value,
                        }),
                    }),
                ],
                modalDisplayStyle: 'popup',
            });
        },
    }),
];
</script>
