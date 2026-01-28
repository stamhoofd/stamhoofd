<template>
    <ModernTableView
        ref="modernTableView"
        :prefix-column="allColumns[0]"
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :default-sort-column="allColumns.find(c => c.id === 'number')"
        :default-filter="defaultFilter"
        :title="title"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :Route="Route"
    >
        <template #empty>
            {{ $t('2bc3b1b5-309c-47e0-a4c4-7145c0ef11af') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { usePresent } from '@simonbackx/vue-app-navigation';
import { Column, ComponentExposed, getPaymentsUIFilterBuilders, ModernTableView, TableAction, useInvoicesObjectFetcher, useTableObjectFetcher } from '@stamhoofd/components';
import { Invoice, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, Ref } from 'vue';
import InvoiceView from './InvoiceView.vue';

const props = withDefaults(
    defineProps<{
        defaultFilter?: StamhoofdFilter | null;
    }>(), {
        defaultFilter: null,
    },
);

type ObjectType = Invoice;

const configurationId = computed(() => {
    return 'invoices';
});

const present = usePresent();
const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const filterBuilders = getPaymentsUIFilterBuilders();
const title = computed(() => {
    return $t('54f30f31-26eb-4801-8f03-4ec17bcb9b95');
});

function getRequiredFilter(): StamhoofdFilter | null {
    return {
        number: {
            $neq: null,
        },
    };
}

const objectFetcher = useInvoicesObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string>({
        id: 'number', /** Note that we use a different id here because that causes us to sort on invoicedAt instead of number, which is faster and more stable (date instead of string) */
        name: '#',
        getValue: object => object.number ?? '',
        getStyleForObject: (object, isPrefix) => {
            if (!isPrefix) {
                return '';
            }
            return 'info';
        },
        minimumWidth: 50,
        recommendedWidth: 50,
    }),

    new Column<ObjectType, string>({
        id: 'customer',
        name: $t('b1ac8856-0f2d-4238-a0f7-1868eebc1df1'),
        getValue: object => object.customer?.company ? (object.customer?.company?.name || '') : (object.customer.name || ''),
        format: value => value || $t('b815f278-1240-4aba-a99a-222d7f43e407'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'customer.company.VATNumber',
        name: $t('96091a9b-0e54-4261-aa43-b28171a9ba97'),
        getValue: object => object.customer?.company ? (object.customer?.company?.VATNumber || '') : '',
        format: value => value || $t('fbbcf6c9-4cfe-4113-be53-6fc15d350642'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, string>({
        id: 'customer.company.companyNumber',
        name: $t('f475a861-b2fe-4b4c-921c-e27a0c19b8e2'),
        getValue: object => object.customer?.company ? (object.customer?.company?.companyNumber || '') : '',
        format: value => value || $t('fbbcf6c9-4cfe-4113-be53-6fc15d350642'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, Date | null>({
        id: 'invoicedAt',
        name: $t('61674904-4043-4c58-ae98-58495f9ae89e'),
        getValue: object => object.invoicedAt,
        format: (value, width) => value ? (width < 150 ? Formatter.dateNumber(value) : Formatter.date(value, true)) : $t('fec48d44-7399-4f84-9eec-e57136fa1b3c'),
        minimumWidth: 120,
        recommendedWidth: 120,
    }),

    new Column<ObjectType, number>({
        id: 'totalWithVAT',
        name: $t('85e54eed-2f1d-46ac-94b0-1070b54ba68d'),
        getValue: object => object.totalWithVAT,
        format: value => Formatter.price(value),
        minimumWidth: 50,
        recommendedWidth: 100,
    }),

    new Column<ObjectType, number>({
        id: 'totalWithoutVAT',
        name: $t('e225a024-7d9d-473a-91db-8bf8a7b97bda'),
        getValue: object => object.totalWithoutVAT,
        format: value => Formatter.price(value),
        minimumWidth: 50,
        recommendedWidth: 100,
    }),

    new Column<ObjectType, number>({
        id: 'VATTotalAmount',
        name: $t('13c04b8f-80f5-4274-9ea1-badb0f88a091'),
        getValue: object => object.VATTotalAmount,
        format: value => Formatter.price(value),
        minimumWidth: 50,
        recommendedWidth: 100,
    }),

];

const Route = {
    Component: InvoiceView,
    objectKey: 'invoices',
};

const actions: TableAction<ObjectType>[] = [
    /* new AsyncTableAction({
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
                            type: ExcelExportType.Payments,
                            filter: selection.filter,
                            workbook: getSelectableWorkbook(),
                            configurationId: configurationId.value,
                        }),
                    }),
                ],
                modalDisplayStyle: 'popup',
            });
        },
    }), */
];

</script>
