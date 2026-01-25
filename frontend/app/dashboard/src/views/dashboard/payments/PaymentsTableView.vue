<template>
    <ModernTableView ref="modernTableView" :table-object-fetcher="tableObjectFetcher" :filter-builders="filterBuilders" :default-sort-column="allColumns.find(c => c.id === 'createdAt')" :default-filter="defaultFilter" :title="title" :column-configuration-id="configurationId" :actions="actions" :all-columns="allColumns" :Route="Route">
        <template #empty>
            {{ $t('763f791b-dd8d-4cb2-aa57-3d93f33a7c8e') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncTableAction, Column, ComponentExposed, getPaymentsUIFilterBuilders, InMemoryTableAction, ModernTableView, PaymentView, TableAction, usePaymentsObjectFetcher, useTableObjectFetcher } from '@stamhoofd/components';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import { ExcelExportType, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, PaymentType, PaymentTypeHelper, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, Ref } from 'vue';
import { useSelectableWorkbook } from './getSelectableWorkbook';
import { useMarkPaymentsPaid } from './hooks/useMarkPaymentsPaid';

const props = withDefaults(
    defineProps<{
        methods?: PaymentMethod[] | null;
        defaultFilter?: StamhoofdFilter | null;
    }>(), {
        methods: null,
        defaultFilter: null,
    },
);

type ObjectType = PaymentGeneral;

const configurationId = computed(() => {
    return 'payments-' + (props.methods?.join('-') ?? '');
});

const present = usePresent();
const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const filterBuilders = getPaymentsUIFilterBuilders();
const title = computed(() => {
    if (props.methods?.length === 1) {
        return PaymentMethodHelper.getPluralNameCapitalized(props.methods[0]);
    }

    return $t('Betalingen');
});

const markPaid = useMarkPaymentsPaid();

function getRequiredFilter(): StamhoofdFilter | null {
    if (props.methods !== null) {
        return {
            method: {
                $in: props.methods,
            },
        };
    }
    return null;
}

const objectFetcher = usePaymentsObjectFetcher({
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
    }),

    new Column<ObjectType, string>({
        id: 'customer.name',
        name: $t('Naam'),
        getValue: object => object.customer?.name ?? '',
        format: value => value || 'Onbekend',
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
    }),

    new Column<ObjectType, PaymentType>({
        id: 'customer.name',
        name: $t('Type'),
        getValue: object => object.type,
        format: value => Formatter.capitalizeFirstLetter(PaymentTypeHelper.getName(value)),
        getStyle: (value) => {
            switch (value) {
                case PaymentType.Payment: return '';
                case PaymentType.Refund: return 'error';
                case PaymentType.Chargeback: return 'error';
                case PaymentType.Reallocation: return 'secundary';
            }
        },
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'customer.company.name',
        name: $t('Bedrijfsnaam'),
        getValue: object => object.customer?.company ? (object.customer?.company?.name || $t('Naamloos')) : '',
        format: value => value || $t('Particulier'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
    }),

    new Column<ObjectType, string | null>({
        id: 'transferDescription',
        name: $t('Mededeling'),
        getValue: object => object.transferDescription,
        format: value => value || 'Geen',
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 120,
        recommendedWidth: 250,
        allowSorting: false,
        enabled: props.methods?.includes(PaymentMethod.Transfer) ?? false,
    }),

    new Column<ObjectType, Date>({
        id: 'createdAt',
        name: $t('Aangemaakt op'),
        getValue: object => object.createdAt,
        format: (value, width) => width < 150 ? Formatter.dateNumber(value) : Formatter.date(value, true),
        minimumWidth: 120,
        recommendedWidth: 120,
    }),

    new Column<ObjectType, PaymentGeneral>({
        id: 'paidAt',
        name: $t('Betaald op'),
        getValue: object => object,
        format: (value, width) => value.paidAt
            ? (width < 150 ? Formatter.dateNumber(value.paidAt) : Formatter.date(value.paidAt, true))
            : (
                    value.status === PaymentStatus.Failed ? $t('Geannuleerd') : $t('Niet betaald')
                ),
        getStyle: value => !value.paidAt ? (value.status === PaymentStatus.Failed ? 'gray' : 'error') : '',
        minimumWidth: 120,
        recommendedWidth: 150,
        enabled: !(props.methods?.includes(PaymentMethod.Transfer) ?? false),
    }),

    new Column<ObjectType, PaymentGeneral>({
        id: 'method',
        name: $t('Betaalmethode'),
        getValue: object => object,
        format: (object) => {
            if (object.method === PaymentMethod.Unknown && object.price === 0) {
                return $t('Niet van toepassing');
            }
            return PaymentMethodHelper.getNameCapitalized(object.method);
        },
        getStyle: value => (value.method === PaymentMethod.Unknown ? 'gray' : ''),
        minimumWidth: 120,
        recommendedWidth: 100,
        allowSorting: false,
        enabled: !props.methods || props.methods.length > 1,
    }),

    new Column<ObjectType, number>({
        id: 'price',
        name: $t('Bedrag'),
        getValue: object => object.price,
        format: value => Formatter.price(value),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 50,
        recommendedWidth: 100,
    }),

    new Column<ObjectType, PaymentStatus>({
        id: 'status',
        name: $t('Status'),
        getValue: object => object.status,
        format: value => PaymentStatusHelper.getNameCapitalized(value),
        getStyle: (value) => {
            switch (value) {
                case PaymentStatus.Pending:
                    return 'warn';
                case PaymentStatus.Created:
                    return 'warn';
                case PaymentStatus.Succeeded:
                    return 'gray';
                case PaymentStatus.Failed:
                    return 'error';
            }
        },
        minimumWidth: 50,
        recommendedWidth: 100,
        allowSorting: false,
    }),

];

const Route = {
    Component: PaymentView,
    objectKey: 'payment',
};

const { getSelectableWorkbook } = useSelectableWorkbook();

const actions: TableAction<ObjectType>[] = [
    new InMemoryTableAction({
        name: $t('Markeer als betaald'),
        icon: 'success',
        priority: 2,
        groupIndex: 1,
        needsSelection: true,
        allowAutoSelectAll: false,
        handler: async (payments: PaymentGeneral[]) => {
            // Mark paid
            await markPaid(payments, true);
        },
    }),
    new InMemoryTableAction({
        name: $t('Markeer als niet betaald'),
        icon: 'canceled',
        priority: 1,
        groupIndex: 1,
        needsSelection: true,
        allowAutoSelectAll: false,
        handler: async (payments: PaymentGeneral[]) => {
            // Mark paid
            await markPaid(payments, false);
        },
    }),

    new AsyncTableAction({
        name: $t('Exporteer naar Excel'),
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
    }),
];

</script>
