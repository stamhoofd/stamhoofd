<template>
    <ModernTableView
        ref="modernTableView" 
        :table-object-fetcher="tableObjectFetcher" 
        :filter-builders="organizationsUIFilterBuilders" 
        :default-sort-direction="SortItemDirection.DESC" 
        :title="title" 
        :column-configuration-id="configurationId" 
        :actions="actions"
        :all-columns="allColumns" 
        @click="showOrganization"
    >
        <template #empty>
            {{ $t('admin.organizations.emptyMessage') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { Column, ComponentExposed, ModernTableView, TableAction, organizationsUIFilterBuilders, useContext, usePlatform, useTableObjectFetcher } from "@stamhoofd/components";
import { useTranslate } from "@stamhoofd/frontend-i18n";
import { CountFilteredRequest, CountResponse, LimitedFilteredRequest, Organization, OrganizationTag, PaginatedResponseDecoder, SortItemDirection, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { Ref, computed, ref } from "vue";
import OrganizationView from "./OrganizationView.vue";
import { ComponentWithProperties, NavigationController, usePresent } from "@simonbackx/vue-app-navigation";

type ObjectType = Organization;
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
    return $t('admin.organizations.allTitle')
})

const context = useContext();
const present = usePresent();
const platform = usePlatform();
const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>
const configurationId = computed(() => {
    return 'organizations'
})

function extendSort(list: SortList): SortList  {
    // Map 'age' to 'birthDay' + reverse direction
    list = list.map(l => {
        if (l.key === 'age') {
            return {key: 'birthDay', order: l.order === SortItemDirection.ASC ? SortItemDirection.DESC : SortItemDirection.ASC}
        }
        return l;
    })

    if (list.find(l => l.key === 'id')) {
        return list;
    }

    // Always add id as an extra sort key for sorters that are not unique
    return [...list, {key: 'id', order: list[0]?.order ?? SortItemDirection.ASC}]
}

function extendFilter(filter: StamhoofdFilter|null): StamhoofdFilter|null  {
    if (!props.tag) {
        return filter;
    }
    
    const requiredExtraFilter = {
        'tags': {
            $eq: props.tag.id
        }
    }

    if (!filter) {
        return requiredExtraFilter;
    }

    return {
        $and: [
            filter,
            requiredExtraFilter
        ]
    }
}

const tableObjectFetcher = useTableObjectFetcher<Organization>({
    async fetch(data: LimitedFilteredRequest) {
        console.log('Organizations.fetch', data);
        data.sort = extendSort(data.sort);
        data.filter = extendFilter(data.filter);

        const response = await context.value.authenticatedServer.request({
            method: "GET",
            path: "/admin/organizations",
            decoder: new PaginatedResponseDecoder(new ArrayDecoder(Organization as Decoder<Organization>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            query: data,
            shouldRetry: false,
            owner: this
        });

        console.log('[Done] Organizations.fetch', data, response.data);
        
        return response.data
    },

    async fetchCount(data: CountFilteredRequest): Promise<number> {
        console.log('Organizations.fetchCount', data);

        data.filter = extendFilter(data.filter);

        const response = await context.value.authenticatedServer.request({
            method: "GET",
            path: "/admin/organizations/count",
            decoder: CountResponse as Decoder<CountResponse>,
            query: data,
            shouldRetry: false,
            owner: this
        })

        console.log('[Done] Organizations.fetchCount', data, response.data.count);
        return response.data.count
    }
});

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string>({
        id: 'name',
        name: "Naam", 
        getValue: (organization) => organization.name,
        minimumWidth: 100,
        recommendedWidth: 200,
        grow: true
    }),
    new Column<ObjectType, string>({
        id: 'city',
        name: "Gemeente", 
        getValue: (organization) => organization.address.city, 
        minimumWidth: 100,
        recommendedWidth: 200
    }),
    new Column<ObjectType, string[]>({
        id: 'tags',
        name: "Tags", 
        getValue: (organization) => organization.meta.tags.map(t => platform.value.config.tags.find(tt => tt.id === t)?.name ?? 'Onbekend'),
        format: (tags) => tags.length === 0 ? 'Geen' : tags.join(', '),
        getStyle: (tags) => tags.length === 0 ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 300
    })
];

async function showOrganization(organization: Organization) {
    if (!modernTableView.value) {
        return;
    }
    
    // todo
    const table = modernTableView.value
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(OrganizationView, {
            organization,
            getNext: table.getNext,
            getPrevious: table.getPrevious
        }),
    });
    
    await present({
        components: [component],
        modalDisplayStyle: "popup"
    });
}

const actions: TableAction<Organization>[] = [
    new TableAction({
        name: $t('admin.organizations.new'),
        icon: "add",
        priority: 0,
        groupIndex: 1,
        needsSelection: false,
        enabled: true,
        handler: async () => {
            // todo
        }
    }),
]
</script>
