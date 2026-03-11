<template>
    <ModernTableView ref="modernTableView" :table-object-fetcher="tableObjectFetcher" :filter-builders="filterBuilders" :default-sort-column="allColumns.find(c => c.id === 'createdAt')" :default-sort-direction="SortItemDirection.DESC" :default-filter="defaultFilter" :title="title" :column-configuration-id="configurationId" :actions="actions" :all-columns="allColumns" :Route="Route">
        <template #empty>
            {{ $t('763f791b-dd8d-4cb2-aa57-3d93f33a7c8e') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { Column, ComponentExposed, getPaymentsUIFilterBuilders, ModernTableView, PaymentView, useFeatureFlag, usePaymentsObjectFetcher, useTableObjectFetcher } from '@stamhoofd/components';
import { PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, PaymentType, PaymentTypeHelper, SortItemDirection, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, Ref } from 'vue';
import { usePaymentActions } from './PaymentActionBuilder';

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

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const filterBuilders = getPaymentsUIFilterBuilders();
const $feature = useFeatureFlag();
const title = computed(() => {
    if (props.methods?.length === 1) {
        return PaymentMethodHelper.getPluralNameCapitalized(props.methods[0]);
    }

    return $t('15589562-1e34-4197-8097-5ec5bf1636fb');
});

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
        name: $t('17edcdd6-4fb2-4882-adec-d3a4f43a1926'),
        getValue: object => object.customer?.dynamicName ?? '',
        format: value => value || $t('49e90fda-d262-4fe7-a2e2-d6b48abc8e2b'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'customer.name',
        name: $t('2a10aac1-e404-4de4-865d-75593b2b5e8d'),
        getValue: object => object.customer?.name ?? '',
        format: value => value || $t('49e90fda-d262-4fe7-a2e2-d6b48abc8e2b'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, string>({
        id: 'description',
        name: $t('11d6f2fc-c72d-4c18-aa6d-b8118c2aaa5c'),
        getValue: object => object.getShortDescription(),
        format: value => value || $t('49e90fda-d262-4fe7-a2e2-d6b48abc8e2b'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 350,
        allowSorting: false,
    }),

    new Column<ObjectType, PaymentType>({
        id: 'type',
        name: $t('23671282-34da-4da9-8afd-503811621055'),
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
        getValue: object => object.customer?.company ? (object.customer?.company?.name || $t('0076d594-efee-4ec7-a00a-073a4c689a38')) : '',
        format: value => value || $t('1474bb78-8f01-456a-9e85-c6b1748b76d5'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, string | null>({
        id: 'transferDescription',
        name: $t('136b7ba4-7611-4ee4-a46d-60758869210f'),
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
        name: $t('297af5d5-1cb0-4862-b8d4-13416bdefa9f'),
        getValue: object => object,
        format: (value, width) => value.paidAt
            ? (width < 150 ? Formatter.dateNumber(value.paidAt) : Formatter.date(value.paidAt, true))
            : (
                    value.status === PaymentStatus.Failed ? $t('72fece9f-e932-4463-9c2b-6e8b22a98f15') : $t('14806378-4cc0-4b16-bd94-82bec5a9572d')
                ),
        getStyle: value => !value.paidAt ? (value.status === PaymentStatus.Failed ? 'gray' : 'error') : '',
        minimumWidth: 120,
        recommendedWidth: 150,
        enabled: (props.methods?.includes(PaymentMethod.Transfer) ?? false),
    }),

    new Column<ObjectType, PaymentGeneral>({
        id: 'method',
        name: $t('07e7025c-0bfb-41be-87bc-1023d297a1a2'),
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

const actionBuilder = usePaymentActions({
    configurationId,
    methods: props.methods,
});

const actions = actionBuilder.getActions();
</script>
