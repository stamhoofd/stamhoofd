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
        name: $t('502dc65d-e8d3-4b20-a478-a76ca9084e60'),
        getValue: object => Formatter.capitalizeFirstLetter(object.category),
        minimumWidth: 100,
        recommendedWidth: 300,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'itemTitle',
        name: $t('109b8d55-5b39-47da-92ad-fbdfa0f3d0b0'),
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
        format: (val, width) => val || $t('3e8d9718-569f-4243-b9ba-ae8f3df6d598'),
        getStyle: val => !val ? 'gray' : '',
        minimumWidth: 150,
        recommendedWidth: 300,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'amount',
        name: $t('697df3e7-fbbf-421d-81c2-9c904dce4842'),
        getValue: object => object.quantity,
        format: (val, width) => Formatter.integer(val),
        minimumWidth: 50,
        recommendedWidth: 150,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'unitPrice',
        name: $t('7453643b-fdb2-4aa1-9964-ddd71762c983'),
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
        name: $t('1205deb9-498d-435d-a6e1-91ea98371523'),
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
        name: $t('18aed6d0-0880-4d06-9260-fe342e6e8064'),
        getValue: object => object.priceOpen,
        format: (val, width) => Formatter.price(val),
        getStyle: val => val === 0 ? 'gray' : (val < 0 ? 'negative' : ''),
        minimumWidth: 50,
        recommendedWidth: 150,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'pricePaid',
        name: $t('25c803f0-6b45-42aa-9b88-573e3706b8bb'),
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
        name: $t('5c75e9bf-1b64-4d28-a435-6e33247d5170'),
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
            format: (val, width) => val || $t('3e8d9718-569f-4243-b9ba-ae8f3df6d598'),
            getStyle: val => !val ? 'gray' : '',
            minimumWidth: 150,
            recommendedWidth: 300,
            enabled: false,
            allowSorting: false,
        });
    }),

    new Column<ObjectType, string>({
        id: 'description',
        name: $t('11d6f2fc-c72d-4c18-aa6d-b8118c2aaa5c'),
        getValue: object => object.description,
        minimumWidth: 100,
        recommendedWidth: 300,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, BalanceItemStatus>({
        id: 'status',
        name: $t('66f5134c-9e11-4d36-88f9-526587491ecb'),
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
        name: $t('60c06238-ad4d-4599-a3d3-ebe856476618'),
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
