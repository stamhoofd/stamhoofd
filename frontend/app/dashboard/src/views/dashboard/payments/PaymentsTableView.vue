<template>
    <ModernTableView ref="modernTableView" :table-object-fetcher="tableObjectFetcher" :filter-builders="filterBuilders" :default-sort-column="allColumns.find(c => c.id === 'createdAt')" :default-sort-direction="SortItemDirection.DESC" :default-filter="defaultFilter" :title="title" :column-configuration-id="configurationId" :actions="actions" :all-columns="allColumns" :Route="Route">
        <template #empty>
            {{ $t('763f791b-dd8d-4cb2-aa57-3d93f33a7c8e') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncTableAction, Column, ComponentExposed, getPaymentsUIFilterBuilders, InMemoryTableAction, ModernTableView, PaymentView, TableAction, useFeatureFlag, usePaymentsObjectFetcher, useTableObjectFetcher } from '@stamhoofd/components';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import { ExcelExportType, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, PaymentType, PaymentTypeHelper, SortItemDirection, StamhoofdFilter } from '@stamhoofd/structures';
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
const $feature = useFeatureFlag();
const title = computed(() => {
    if (props.methods?.length === 1) {
        return PaymentMethodHelper.getPluralNameCapitalized(props.methods[0]);
    }

    return $t('15589562-1e34-4197-8097-5ec5bf1636fb');
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
        enabled: false,
    }),

    new Column<ObjectType, string>({
        id: 'customer',
        name: $t('af509b7e-1810-45d7-ad71-22add73ffc16'),
        getValue: object => object.customer?.dynamicName ?? '',
        format: value => value || $t('fe9408c1-4047-4bd3-bccc-096ae1b9bb43'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'customer.name',
        name: $t('9fb003b3-9fce-49fc-9deb-beb9bbd14715'),
        getValue: object => object.customer?.name ?? '',
        format: value => value || $t('fe9408c1-4047-4bd3-bccc-096ae1b9bb43'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, string>({
        id: 'description',
        name: $t('6a019ac6-c249-48da-b151-f66ed8477414'),
        getValue: object => object.getShortDescription(),
        format: value => value || $t('fe9408c1-4047-4bd3-bccc-096ae1b9bb43'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 350,
        allowSorting: false,
    }),

    new Column<ObjectType, PaymentType>({
        id: 'type',
        name: $t('97c32bed-6241-48c5-89a8-65ae68d6f562'),
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
        enabled: !(props.methods?.includes(PaymentMethod.Transfer) ?? false),
    }),

    new Column<ObjectType, string>({
        id: 'customer.company.name',
        name: $t('67928a02-b3f1-465a-9dd7-569d061599a9'),
        getValue: object => object.customer?.company ? (object.customer?.company?.name || $t('b815f278-1240-4aba-a99a-222d7f43e407')) : '',
        format: value => value || $t('1474bb78-8f01-456a-9e85-c6b1748b76d5'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, string | null>({
        id: 'transferDescription',
        name: $t('89c6f3c9-8485-4441-9592-0c3ec444df82'),
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
        name: $t('10fd24bb-43dd-4174-9a23-db3ac54af9be'),
        getValue: object => object.createdAt,
        format: (value, width) => width < 150 ? Formatter.dateNumber(value) : Formatter.date(value, true),
        minimumWidth: 120,
        recommendedWidth: 120,
    }),

    new Column<ObjectType, PaymentGeneral>({
        id: 'paidAt',
        name: $t('4681e002-1991-4dfb-bd13-d5eb64996864'),
        getValue: object => object,
        format: (value, width) => value.paidAt
            ? (width < 150 ? Formatter.dateNumber(value.paidAt) : Formatter.date(value.paidAt, true))
            : (
                    value.status === PaymentStatus.Failed ? $t('edbf6a36-2c1f-4098-9ccb-108ca37b14d6') : $t('ee6b5533-bea8-481d-9dc7-b7b5baac32a2')
                ),
        getStyle: value => !value.paidAt ? (value.status === PaymentStatus.Failed ? 'gray' : 'error') : '',
        minimumWidth: 120,
        recommendedWidth: 150,
        enabled: (props.methods?.includes(PaymentMethod.Transfer) ?? false),
    }),

    new Column<ObjectType, PaymentGeneral>({
        id: 'method',
        name: $t('8415e8c8-7c6a-4963-8b41-299d112aa847'),
        getValue: object => object,
        format: (object) => {
            if (object.method === PaymentMethod.Unknown && object.price === 0) {
                return $t('27dfbf35-ff79-4317-9b44-b8936e8f6ac3');
            }
            return PaymentMethodHelper.getNameCapitalized(object.method);
        },
        getStyle: value => (value.method === PaymentMethod.Unknown ? 'gray' : ''),
        minimumWidth: 120,
        recommendedWidth: 100,
        enabled: !props.methods || props.methods.length > 1,
    }),

    new Column<ObjectType, number>({
        id: 'price',
        name: $t('43ca079c-2af8-4bde-9f68-abeca3c3a7d0'),
        getValue: object => object.price,
        format: value => Formatter.price(value),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 50,
        recommendedWidth: 100,
    }),

    new Column<ObjectType, PaymentStatus>({
        id: 'status',
        name: $t('66f5134c-9e11-4d36-88f9-526587491ecb'),
        getValue: object => object.status,
        format: value => PaymentStatusHelper.getNameCapitalized(value),
        getStyle: (value) => {
            switch (value) {
                case PaymentStatus.Pending:
                    return 'warn';
                case PaymentStatus.Created:
                    return 'warn';
                case PaymentStatus.Succeeded:
                    return 'success';
                case PaymentStatus.Failed:
                    return 'error';
            }
        },
        minimumWidth: 50,
        recommendedWidth: 100,
        allowSorting: false,
        enabled: !!props.methods,
    }),

    ...(
        $feature('vat')
            ? [
                    new Column<ObjectType, boolean>({
                        id: 'hasInvoice',
                        name: $t('ada625d2-2e7e-42a9-b808-073a18b19316'),
                        getValue: object => !!object.invoiceId,
                        format: (value) => {
                            if (value) {
                                return $t('b5d89272-7ee8-4bd3-80fb-5b99398a4c0b');
                            }
                            return $t('6c75a19d-c412-4adb-8aaf-70d10a9c5987');
                        },
                        getStyle: value => !value ? 'gray' : '',
                        minimumWidth: 100,
                        recommendedWidth: 100,
                    }),
                ]
            : []
    ),

];

const Route = {
    Component: PaymentView,
    objectKey: 'payment',
};

const { getSelectableWorkbook } = useSelectableWorkbook();

const actions: TableAction<ObjectType>[] = [
    new InMemoryTableAction({
        name: $t('03bd6cff-83c4-44ec-8b0d-7826bf5b4166'),
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
        name: $t('fb1d3820-b4d3-446b-ab4b-931b16eb5391'),
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
    }),
];

</script>
