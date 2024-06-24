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
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, usePresent } from "@simonbackx/vue-app-navigation";
import { Column, ComponentExposed, ModernTableView, TableAction, Toast, organizationsUIFilterBuilders, useAuth, useContext, usePlatform, useTableObjectFetcher } from "@stamhoofd/components";
import { I18nController, useTranslate } from "@stamhoofd/frontend-i18n";
import { useRequestOwner } from "@stamhoofd/networking";
import { Address, CountFilteredRequest, CountResponse, LimitedFilteredRequest, Organization, OrganizationTag, PaginatedResponseDecoder, SortItemDirection, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { Ref, computed, ref } from "vue";
import EditOrganizationView from "./EditOrganizationView.vue";
import OrganizationView from "./OrganizationView.vue";

type ObjectType = Organization;
const $t = useTranslate();
const owner = useRequestOwner();

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
const auth = useAuth()
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

const actions: TableAction<Organization>[] = []

if (auth.hasPlatformFullAccess()) {
    actions.push(
        new TableAction({
            name: $t('admin.organizations.new'),
            icon: "add",
            priority: 0,
            groupIndex: 1,
            needsSelection: false,
            enabled: true,
            handler: async () => {
                const organization = Organization.create({
                    address: Address.createDefault(I18nController.shared.country)
                });

                const component = new ComponentWithProperties(EditOrganizationView, {
                    isNew: true,
                    organization,
                    saveHandler: async (patch: AutoEncoderPatchType<Organization>) => {
                        const put = organization.patch(patch);

                        const arr: PatchableArrayAutoEncoder<Organization> = new PatchableArray();
                        arr.addPut(put);
                    
                        await context.value.authenticatedServer.request({
                            method: 'PATCH',
                            path: '/admin/organizations',
                            body: arr,
                            shouldRetry: false,
                            owner,
                            decoder: new ArrayDecoder(Organization as Decoder<Organization>)
                        });
                        new Toast($t('admin.organizations.createSucceeded'), "success green").show()

                        // Reload table
                        tableObjectFetcher.reset(true, true)
                    }
                })

                await present({
                    modalDisplayStyle: 'popup',
                    components: [component]
                })
            }
        })
    )
}
</script>
