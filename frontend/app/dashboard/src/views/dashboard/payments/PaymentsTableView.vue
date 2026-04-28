<template>
    <ModernTableView ref="modernTableView" :table-object-fetcher="tableObjectFetcher" :filter-builders="filterBuilders" :default-sort-column="allColumns.find(c => c.id === 'createdAt')" :default-sort-direction="SortItemDirection.DESC" :default-filter="defaultFilter" :title="title" :column-configuration-id="configurationId" :actions="actions" :all-columns="allColumns" :Route="Route">
        <template #empty>
            {{ $t('%Lu') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import type { ComponentExposed } from '@stamhoofd/components/VueGlobalHelper.ts';
import { getPaymentsUIFilterBuilders } from '@stamhoofd/components/filters/filterBuilders.ts';
import ModernTableView from '@stamhoofd/components/tables/ModernTableView.vue';
import PaymentView from '@stamhoofd/components/payments/PaymentView.vue';
import { Column } from '@stamhoofd/components/tables/classes/Column.ts';
import { useFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { usePaymentsObjectFetcher } from '@stamhoofd/components/fetchers/usePaymentsObjectFetcher.ts';
import { useTableObjectFetcher } from '@stamhoofd/components/tables/classes/TableObjectFetcher.ts';
import type { PaymentGeneral, StamhoofdFilter } from '@stamhoofd/structures';
import { PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, PaymentType, PaymentTypeHelper, SortItemDirection } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';
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

    return $t('%1JH');
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
        name: $t('%1Os'),
        getValue: object => object.customer?.dynamicName ?? '',
        format: value => value || $t('%Gr'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'customer.name',
        name: $t('%1Kl'),
        getValue: object => object.customer?.name ?? '',
        format: value => value || $t('%Gr'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, string>({
        id: 'description',
        name: $t('%6o'),
        getValue: object => object.getShortDescription(),
        format: value => value || $t('%Gr'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 350,
        allowSorting: false,
    }),

    new Column<ObjectType, PaymentType>({
        id: 'type',
        name: $t('%1LP'),
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
        name: $t('%1JI'),
        getValue: object => object.customer?.company ? (object.customer?.company?.name || $t('%CL')) : '',
        format: value => value || $t('%1J8'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, string | null>({
        id: 'transferDescription',
        name: $t('%J8'),
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
        name: $t('%1JJ'),
        getValue: object => object.createdAt,
        format: (value, width) => width < 150 ? Formatter.dateNumber(value) : Formatter.date(value, true),
        minimumWidth: 120,
        recommendedWidth: 120,
    }),

    new Column<ObjectType, PaymentGeneral>({
        id: 'paidAt',
        name: $t('%wY'),
        getValue: object => object,
        format: (value, width) => value.paidAt
            ? (width < 150 ? Formatter.dateNumber(value.paidAt) : Formatter.date(value.paidAt, true))
            : (
                    value.status === PaymentStatus.Failed ? $t('%gg') : $t('%18v')
                ),
        getStyle: value => !value.paidAt ? (value.status === PaymentStatus.Failed ? 'gray' : 'error') : '',
        minimumWidth: 120,
        recommendedWidth: 150,
        enabled: (props.methods?.includes(PaymentMethod.Transfer) ?? false),
    }),

    new Column<ObjectType, PaymentGeneral>({
        id: 'method',
        name: $t('%M7'),
        getValue: object => object,
        format: (object) => {
            if (object.method === PaymentMethod.Unknown && object.price === 0) {
                return $t('%1JK');
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
        name: $t('%1JL'),
        getValue: object => object.price,
        format: value => Formatter.price(value),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 50,
        recommendedWidth: 100,
    }),

    new Column<ObjectType, PaymentStatus>({
        id: 'status',
        name: $t('%1JM'),
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
                        name: $t('%1JN'),
                        getValue: object => !!object.invoiceId,
                        format: (value) => {
                            if (value) {
                                return $t('%1JO');
                            }
                            return $t('%1JP');
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
