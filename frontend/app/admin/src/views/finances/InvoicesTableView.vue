<template>
    <ModernTableView
        ref="modernTableView" 
        :table-object-fetcher="tableObjectFetcher" 
        :filter-builders="invoicesUIFilterBuilders" 
        :default-sort-direction="SortItemDirection.DESC" 
        :title="title" 
        :column-configuration-id="configurationId" 
        :actions="actions"
        :all-columns="allColumns" 
        @click="showInvoice"
    >
        <template #empty>
            {{ $t('admin.invoices.emptyMessage') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, usePresent } from "@simonbackx/vue-app-navigation";
import { Column, ComponentExposed, ModernTableView, TableAction, invoicesUIFilterBuilders, useAuth, useContext, usePlatform, useTableObjectFetcher } from "@stamhoofd/components";
import { useTranslate } from "@stamhoofd/frontend-i18n";
import { CountFilteredRequest, CountResponse, LimitedFilteredRequest, OrganizationTag, PaginatedResponseDecoder, STInvoicePrivate, SortItemDirection, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Ref, computed, ref } from "vue";
import OrganizationView from "../organizations/OrganizationView.vue";

type ObjectType = STInvoicePrivate;
const $t = useTranslate();

const props = withDefaults(
    defineProps<{
        tag?: OrganizationTag|null
    }>(), 
    {
        tag: null
    }
)

const title = computed(() => {
    if (props.tag) {
        return props.tag.name
    }
    return $t('admin.invoices.title')
})

const context = useContext();
const present = usePresent();
const platform = usePlatform();
const auth = useAuth()
const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>
const configurationId = computed(() => {
    return 'invoices'
})

function extendSort(list: SortList): SortList  {
    if (list.find(l => l.key === 'id')) {
        return list;
    }

    // Always add id as an extra sort key for sorters that are not unique
    return [...list, {key: 'id', order: list[0]?.order ?? SortItemDirection.ASC}]
}


const tableObjectFetcher = useTableObjectFetcher<STInvoicePrivate>({
    async fetch(data: LimitedFilteredRequest) {
        console.log('Invoices.fetch', data);
        data.sort = extendSort(data.sort);

        const response = await context.value.authenticatedServer.request({
            method: "GET",
            path: "/admin/invoices",
            decoder: new PaginatedResponseDecoder(new ArrayDecoder(STInvoicePrivate as Decoder<STInvoicePrivate>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            query: data,
            shouldRetry: false,
            owner: this
        });

        console.log('[Done] Invoices.fetch', data, response.data);
        
        return response.data
    },

    async fetchCount(data: CountFilteredRequest): Promise<number> {
        console.log('Invoices.fetchCount', data);

        const response = await context.value.authenticatedServer.request({
            method: "GET",
            path: "/admin/invoices/count",
            decoder: CountResponse as Decoder<CountResponse>,
            query: data,
            shouldRetry: false,
            owner: this
        })

        console.log('[Done] Invoices.fetchCount', data, response.data.count);
        return response.data.count
    }
});

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, number>({
        id: 'number',
        name: "#", 
        getValue: (invoice) => invoice.number ?? 0, 
        minimumWidth: 70,
        recommendedWidth: 70,
        getStyleForObject: (_, isPrefix) => {
            if (!isPrefix) {
                return ""
            }
            return "primary"
        }
    }),
    new Column<STInvoicePrivate, string>({
        id: 'companyName',
        name: "Naam", 
        getValue: (invoice) => invoice.meta.companyName, 
        minimumWidth: 100,
        recommendedWidth: 400,
        grow: true,
    }),
    new Column<STInvoicePrivate, string | null>({
        id: 'reference',
        name: "Referentie", 
        getValue: (invoice) => invoice.reference, 
        getStyle: (value) => {
            if (value === null) {
                return "gray"
            }
            return ""
        },
        format: (value) => value ?? "Geen",
        minimumWidth: 100,
        recommendedWidth: 400,
        grow: false,
    }),
    new Column<STInvoicePrivate, Date | null>({
        id: 'date',
        name: "Datum", 
        getValue: (invoice) => invoice.meta.date ?? invoice.paidAt ?? invoice.createdAt, 
        format: (value) => value === null ? "Niet uitbetaald" : Formatter.date(value),
        getStyle: (value) => {
            if (value === null) {
                return "gray"
            }
            return ""
        },
        minimumWidth: 100,
        recommendedWidth: 100,
    }),

    new Column<STInvoicePrivate, string>({
        allowSorting: false,
        id: 'city',
        name: "Gemeente", 
        getValue: (invoice) => invoice.meta.companyAddress.city, 
        minimumWidth: 100,
        recommendedWidth: 100,
    }),

    new Column<STInvoicePrivate, number>({
        allowSorting: false,
        id: 'priceWithoutVAT',
        name: "Bedrag (excl)", 
        getValue: (invoice) => invoice.meta.priceWithoutVAT, 
        format: (value) => Formatter.price(value),
        minimumWidth: 50,
        recommendedWidth: 100,
    }),

    new Column<STInvoicePrivate, Date | null>({
        id: 'settledAt',
        name: "Uitbetalingsdatum", 
        getValue: (invoice) => invoice.settlement?.settledAt ?? null, 
        format: (value) => value === null ? "Niet uitbetaald" : Formatter.date(value),
        getStyle: (value) => {
            if (value === null) {
                return "gray"
            }
            return ""
        },
        minimumWidth: 50,
        recommendedWidth: 100,
        allowSorting: false
    }),

    new Column<STInvoicePrivate, string | null>({
        id: 'companyVATNumber',
        enabled: false,
        name: "BTW-nummer", 
        getValue: (invoice) => invoice.meta.companyVATNumber, 
        getStyle: (value) => {
            if (value === null) {
                return "gray"
            }
            return ""
        },
        format: (value) => value ?? "Geen",
        minimumWidth: 100,
        recommendedWidth: 400,
        grow: false,
        allowSorting: false
    }),

    new Column<STInvoicePrivate, string | null>({
        id: 'companyNumber',
        allowSorting: false,
        enabled: false,
        name: "Ondernemingsnummer", 
        getValue: (invoice) => invoice.meta.companyNumber, 
        getStyle: (value) => {
            if (value === null) {
                return "gray"
            }
            return ""
        },
        format: (value) => value ?? "Geen",
        minimumWidth: 100,
        recommendedWidth: 400,
        grow: false,
    }),
];

async function showInvoice(invoice: STInvoicePrivate) {
    if (!modernTableView.value) {
        return;
    }
    
    // todo
    const table = modernTableView.value
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(OrganizationView, {
            invoice,
            getNext: table.getNext,
            getPrevious: table.getPrevious
        }),
    });
    
    await present({
        components: [component],
        modalDisplayStyle: "popup"
    });
}

const actions: TableAction<STInvoicePrivate>[] = []
</script>
