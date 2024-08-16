<template>
    <ModernTableView
        ref="modernTableView" 
        :table-object-fetcher="tableObjectFetcher" 
        :filter-builders="filterBuilders" 
        :default-sort-direction="SortItemDirection.DESC" 
        :default-sort-column="allColumns.find(c => c.id == 'createdAt')"
        :default-filter="defaultFilter"
        :title="title" 
        :column-configuration-id="configurationId" 
        :actions="actions"
        :all-columns="allColumns" 
        @click="showPayment"
    >
        <template #empty>
            Geen betalingen gevonden
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { Column, ComponentExposed, InMemoryTableAction, ModernTableView, paymentsUIFilterBuilders, PaymentView, TableAction, Toast, useContext, useTableObjectFetcher } from '@stamhoofd/components';
import { assertSort, CountFilteredRequest, CountResponse, LimitedFilteredRequest, PaginatedResponseDecoder, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, SortItemDirection, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed, ref, Ref } from 'vue';
import { useMarkPaymentsPaid } from './hooks/useMarkPaymentsPaid';

const props = withDefaults(
    defineProps<{
        methods?: PaymentMethod[]|null,
        defaultFilter?: StamhoofdFilter|null
    }>(), {
        methods: null,
        defaultFilter: null
    }
)

type ObjectType = PaymentGeneral;

enum Routes {
    Payment = "Payment"
}

defineRoutes([
    {
        name: Routes.Payment,
        url: "@id",
        component: PaymentView as unknown as ComponentOptions,
        params: {
            id: String
        },
        present: 'popup',
        paramsToProps: async (params: {id: string}) => {
            // Fetch event
            const payments = await tableObjectFetcher.objectFetcher.fetch(
                new LimitedFilteredRequest({
                    filter: {
                        id: params.id
                    },
                    limit: 1,
                    sort: []
                })
            )

            if (payments.results.length === 1) {
                return {
                    initialPayment: payments.results[0]
                }
            }
            Toast.error('Betaling niet gevonden').show()
            throw new Error('Payment not found')
        },

        propsToParams(props) {
            if (!("initialPayment" in props) || typeof props.initialPayment !== 'object' || props.initialPayment === null || !(props.initialPayment instanceof PaymentGeneral)) {
                throw new Error('Missing payment')
            }
            const payment = props.initialPayment;

            return {
                params: {
                    id: payment.id
                }
            }
        }
    }
])

const configurationId = computed(() => {
    return 'payments'
})

const context = useContext();
const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>
const filterBuilders = paymentsUIFilterBuilders
const title = computed(() => {
    if (props.methods?.length === 1) {
        return Formatter.capitalizeFirstLetter(PaymentMethodHelper.getPluralName(props.methods[0]))
    }

    return "Betalingen"
})

const $navigate = useNavigate();
const markPaid = useMarkPaymentsPaid()

function getRequiredFilter(): StamhoofdFilter|null  {
    if (props.methods !== null) {
        return {
            method: {
                $in: props.methods
            }
        }
    }
    return null;
}

function extendSort(list: SortList): SortList  {
    return assertSort(list, [{key: 'id'}])
}

const tableObjectFetcher = useTableObjectFetcher<ObjectType>({
    requiredFilter: getRequiredFilter(),
    async fetch(data: LimitedFilteredRequest): Promise<{results: ObjectType[], next?: LimitedFilteredRequest}> {
        data.sort = extendSort(data.sort);

        const response = await context.value.authenticatedServer.request({
            method: "GET",
            path: "/payments",
            decoder: new PaginatedResponseDecoder(new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            query: data,
            shouldRetry: false,
            owner: this
        });

        return response.data
    },

    async fetchCount(data: CountFilteredRequest): Promise<number> {
        const response = await context.value.authenticatedServer.request({
            method: "GET",
            path: "/payments/count",
            decoder: CountResponse as Decoder<CountResponse>,
            query: data,
            shouldRetry: false,
            owner: this
        })

        return response.data.count
    }
});

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string>({
        id: 'id',
        name: "ID", 
        getValue: (object) => object.id,
        getStyle: () => 'code',
        minimumWidth: 50,
        recommendedWidth: 50,
    }),

    new Column<ObjectType, string>({
        id: 'customer.name',
        name: "Naam", 
        getValue: (object) => object.customer?.name ?? '',
        format: (value) => value || 'Onbekend',
        getStyle: (value) => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'customer.company.name',
        name: "Bedrijfsnaam", 
        getValue: (object) => object.customer?.company ? (object.customer?.company?.name || 'Naamloos') : '',
        format: (value) => value || 'Particulier',
        getStyle: (value) => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
    }),

    new Column<ObjectType, Date>({
        id: 'createdAt',
        name: "Aangemaakt op", 
        getValue: (object) => object.createdAt,
        format: (value, width) => width < 150 ? Formatter.dateNumber(value) : Formatter.date(value, true),
        minimumWidth: 120,
        recommendedWidth: 150,
    }),

    new Column<ObjectType, Date|null>({
        id: 'paidAt',
        name: "Betaald op", 
        getValue: (object) => object.paidAt,
        format: (value, width) => value ? (width < 150 ? Formatter.dateNumber(value) : Formatter.date(value, true)) : 'Niet betaald',
        getStyle: (value) => !value ? 'error' : '',
        minimumWidth: 120,
        recommendedWidth: 150,
    }),

    new Column<ObjectType, PaymentMethod>({
        id: 'method',
        name: "Betaalmethode", 
        getValue: (object) => object.method,
        format: (value) => PaymentMethodHelper.getNameCapitalized(value),
        minimumWidth: 120,
        recommendedWidth: 100,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'price',
        name: "Bedrag", 
        getValue: (object) => object.price,
        format: (value) => Formatter.price(value),
        getStyle: (value) => !value ? 'gray' : '',
        minimumWidth: 50,
        recommendedWidth: 100,
    }),

    new Column<ObjectType, PaymentStatus>({
        id: 'status',
        name: "Status", 
        getValue: (object) => object.status,
        format: (value) => PaymentStatusHelper.getNameCapitalized(value),
        getStyle: (value) => {
            switch (value) {
                case PaymentStatus.Pending:
                    return 'warn'
                case PaymentStatus.Created:
                    return 'warn'
                case PaymentStatus.Succeeded:
                    return 'gray'
                case PaymentStatus.Failed:
                    return 'error'
            }
        },
        minimumWidth: 50,
        recommendedWidth: 100,
        allowSorting: false,
    }),
    
];

async function showPayment(payment: PaymentGeneral) {
    await $navigate(Routes.Payment, {properties: {initialPayment: payment}})
}

const actions: TableAction<ObjectType>[] = [
    new InMemoryTableAction({
        name: "Markeer als betaald",
        icon: "success",
        priority: 2,
        groupIndex: 1,
        needsSelection: true,
        allowAutoSelectAll: false,
        handler: async (payments: PaymentGeneral[]) => {
            // Mark paid
            await markPaid(payments, true)
        }
    }),
    new InMemoryTableAction({
        name: "Markeer als niet betaald",
        icon: "canceled",
        priority: 1,
        groupIndex: 1,
        needsSelection: true,
        allowAutoSelectAll: false,
        handler: async (payments: PaymentGeneral[]) => {
            // Mark paid
            await markPaid(payments, false)
        }
    }),
]



</script>
