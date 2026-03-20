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
            {{ $t('%1J9') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { usePresent } from '@simonbackx/vue-app-navigation';
import type { ComponentExposed } from '@stamhoofd/components/VueGlobalHelper.ts';
import { Column } from '@stamhoofd/components/tables/classes/Column.ts';
import { getPaymentsUIFilterBuilders } from '@stamhoofd/components/filters/filterBuilders.ts';
import ModernTableView from '@stamhoofd/components/tables/ModernTableView.vue';
import type { TableAction } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { useInvoicesObjectFetcher } from '@stamhoofd/components/fetchers/useInvoicesObjectFetcher.ts';
import { useTableObjectFetcher } from '@stamhoofd/components/tables/classes/TableObjectFetcher.ts';
import type { Invoice, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';
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
    return $t('%1JA');
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
        name: $t('%1J1'),
        getValue: object => object.customer?.company ? (object.customer?.company?.name || '') : (object.customer.name || ''),
        format: value => value || $t('%CL'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'customer.company.VATNumber',
        name: $t('%1CK'),
        getValue: object => object.customer?.company ? (object.customer?.company?.VATNumber || '') : '',
        format: value => value || $t('%1FW'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, string>({
        id: 'customer.company.companyNumber',
        name: $t('%wa'),
        getValue: object => object.customer?.company ? (object.customer?.company?.companyNumber || '') : '',
        format: value => value || $t('%1FW'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, Date | null>({
        id: 'invoicedAt',
        name: $t('%7R'),
        getValue: object => object.invoicedAt,
        format: (value, width) => value ? (width < 150 ? Formatter.dateNumber(value) : Formatter.date(value, true)) : $t('%1JB'),
        minimumWidth: 120,
        recommendedWidth: 120,
    }),

    new Column<ObjectType, number>({
        id: 'totalWithVAT',
        name: $t('%1JC'),
        getValue: object => object.totalWithVAT,
        format: value => Formatter.price(value),
        minimumWidth: 50,
        recommendedWidth: 100,
    }),

    new Column<ObjectType, number>({
        id: 'totalWithoutVAT',
        name: $t('%1JD'),
        getValue: object => object.totalWithoutVAT,
        format: value => Formatter.price(value),
        minimumWidth: 50,
        recommendedWidth: 100,
    }),

    new Column<ObjectType, number>({
        id: 'VATTotalAmount',
        name: $t('%1JE'),
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
