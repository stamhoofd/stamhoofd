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
    return $t('Aanrekeningen');
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
        name: $t('Type'),
        getValue: object => object.type,
        format: val => getBalanceItemTypeName(val),
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'category',
        name: $t('Categorie'),
        getValue: object => Formatter.capitalizeFirstLetter(object.category),
        minimumWidth: 100,
        recommendedWidth: 300,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'itemTitle',
        name: $t('Titel'),
        getValue: object => object.itemTitle,
        minimumWidth: 150,
        recommendedWidth: 300,
        enabled: true,
        grow: true,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'itemDescription',
        name: $t('Ondertitel'),
        getValue: object => object.itemDescription ?? '',
        format: (val, width) => val || $t('Leeg'),
        getStyle: val => !val ? 'gray' : '',
        minimumWidth: 150,
        recommendedWidth: 300,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'amount',
        name: $t('Aantal'),
        getValue: object => object.quantity,
        format: (val, width) => Formatter.integer(val),
        minimumWidth: 50,
        recommendedWidth: 150,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'unitPrice',
        name: $t('Eenheidsprijs'),
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
        name: $t('Prijs'),
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
        name: $t('Te betalen'),
        getValue: object => object.priceOpen,
        format: (val, width) => Formatter.price(val),
        getStyle: val => val === 0 ? 'gray' : (val < 0 ? 'negative' : ''),
        minimumWidth: 50,
        recommendedWidth: 150,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'pricePaid',
        name: $t('Betaald bedrag'),
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
        name: $t('In verwerking'),
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
            format: (val, width) => val || $t('Leeg'),
            getStyle: val => !val ? 'gray' : '',
            minimumWidth: 150,
            recommendedWidth: 300,
            enabled: false,
            allowSorting: false,
        });
    }),

    new Column<ObjectType, string>({
        id: 'description',
        name: $t('Beschrijving'),
        getValue: object => object.description,
        minimumWidth: 100,
        recommendedWidth: 300,
        enabled: false,
        allowSorting: false,
    }),

    new Column<ObjectType, BalanceItemStatus>({
        id: 'status',
        name: $t('Status'),
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
