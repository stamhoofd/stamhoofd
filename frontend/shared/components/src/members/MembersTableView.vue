<template>
    <ModernTableView
        ref="modernTableView" 
        :table-object-fetcher="tableObjectFetcher" 
        :filter-builders="memberWithRegistrationsBlobUIFilterBuilders" 
        :default-sort-direction="SortItemDirection.DESC" 
        :title="title" 
        :column-configuration-id="configurationId" 
        :actions="actions"
        :all-columns="allColumns" 
        @click="showMember"
    >
        <template #empty>
            Er zijn nog geen leden ingeschreven.
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, usePresent } from "@simonbackx/vue-app-navigation";
import { Column, ComponentExposed, EditMemberGeneralBox, MemberStepView, ModernTableView, NavigationActions, TableAction, memberWithRegistrationsBlobUIFilterBuilders, useAppContext, useAuth, useContext, useOrganization, usePlatform, useTableObjectFetcher } from "@stamhoofd/components";
import { useTranslate } from "@stamhoofd/frontend-i18n";
import { CountFilteredRequest, CountResponse, Group, LimitedFilteredRequest, MembersBlob, Organization, PaginatedResponseDecoder, Platform, PlatformFamily, PlatformMember, SortItemDirection, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Ref, computed, reactive, ref } from "vue";
import MemberSegmentedView from './MemberSegmentedView.vue';
import RegisterMemberView from "./RegisterMemberView.vue";

type ObjectType = PlatformMember;

const props = withDefaults(
    defineProps<{
        group?: Group | null,
        waitingList?: boolean,
        cycleOffset?: number
    }>(), {
        group: null,
        waitingList: false,
        cycleOffset: 0
    }
)

const title = computed(() => {
    if (props.waitingList) {
        return "Wachtlijst"
    }

    if (props.group) {
        return props.group.settings.name
    }

    return 'Leden'
})

const context = useContext();
const present = usePresent();
const app = useAppContext();
const $t = useTranslate();
const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>
const auth = useAuth();
const organization = useOrganization();
const platform = usePlatform()
const configurationId = computed(() => {
    return 'members-'+app
})

function extendSort(list: SortList): SortList  {
    if (list.find(l => l.key === 'id')) {
        return list;
    }

    // Always add id as an extra sort key for sorters that are not unique
    return [...list, {key: 'id', order: list[0]?.order ?? SortItemDirection.ASC}]
}

function extendFilter(filter: StamhoofdFilter|null): StamhoofdFilter|null  {
    if (!props.group) {
        return filter;
    }

    const requiredExtraFilter = {
        'registrations': {
            $elemMatch: {
                waitingList: props.waitingList,
                cycleOffset: props.cycleOffset ?? 0,
                groupId: props.group.id
            }
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

const tableObjectFetcher = useTableObjectFetcher<PlatformMember>({
    async fetch(data: LimitedFilteredRequest): Promise<{results: ObjectType[], next?: LimitedFilteredRequest}> {
        console.log('Members.fetch', data);
        data.sort = extendSort(data.sort);
        data.filter = extendFilter(data.filter);

        const response = await context.value.authenticatedServer.request({
            method: "GET",
            path: "/members",
            decoder: new PaginatedResponseDecoder(MembersBlob as Decoder<MembersBlob>, LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            query: data,
            shouldRetry: false,
            owner: this
        });

        console.log('[Done] Members.fetch', data, response.data);

        const blob = response.data.results;
        
        return {
            results: PlatformFamily.createSingles(blob, {
                contextOrganization: context.value.organization,
                platform: Platform.shared
            }),
            next: response.data.next
        }
    },

    async fetchCount(data: CountFilteredRequest): Promise<number> {
        console.log('Members.fetchCount', data);

        data.filter = extendFilter(data.filter);

        const response = await context.value.authenticatedServer.request({
            method: "GET",
            path: "/members/count",
            decoder: CountResponse as Decoder<CountResponse>,
            query: data,
            shouldRetry: false,
            owner: this
        })

        console.log('[Done] Members.fetchCount', data, response.data.count);
        return response.data.count
    }
});

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string>({
        id: 'name',
        name: "Naam", 
        getValue: (member) => member.member.name,
        minimumWidth: 100,
        recommendedWidth: 200,
        grow: true
    }),
    new Column<ObjectType, Date | null>({
        id: 'birthDay',
        name: "Geboortedatum", 
        getValue: (member) => member.member.details.birthDay, 
        format: (date) => date ? Formatter.dateNumber(date, true) : '',
        minimumWidth: 50,
        recommendedWidth: 170,
        enabled: false
    }),
    new Column<ObjectType, number | null>({
        id: 'age',
        name: "Leeftijd", 
        getValue: (member) => member.member.details.age, 
        format: (age) => age ? Formatter.integer(age) + ' jaar' : 'onbekend',
        minimumWidth: 30,
        recommendedWidth: 120,
    })
];

if (app == 'admin') {
    allColumns.push(
        new Column<ObjectType, Organization[]>({
            id: 'organization',
            allowSorting: false,
            name: $t('shared.organization.singular'), 
            getValue: (member) => member.organizations, 
            format: (organizations) => Formatter.joinLast(organizations.map(o => o.name), ', ', ' en ') || $t('shared.notRegistered'),
            getStyle: (organizations) => organizations.length == 0 ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 300,
        })
    )
}

async function showMember(member: PlatformMember) {
    if (!modernTableView.value) {
        return;
    }
    
    const table = modernTableView.value
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(MemberSegmentedView, {
            member,
            getNext: table.getNext,
            getPrevious: table.getPrevious,
            group: props.group,
            cycleOffset: props.cycleOffset,
            waitingList: props.waitingList
        }),
    });

    await present({
        components: [component],
        modalDisplayStyle: "popup"
    });
}

const actions: TableAction<PlatformMember>[] = [
    new TableAction({
        name: "Nieuw lid",
        icon: "add",
        priority: 0,
        groupIndex: 1,
        needsSelection: false,
        enabled: (props.group && organization.value ? props.group.hasWriteAccess(auth.permissions, organization.value) : auth.permissions?.hasWriteAccess()) && !props.waitingList,
        handler: async () => {
            const family = new PlatformFamily({
                contextOrganization: organization.value,
                platform: platform.value
            })
            const member = reactive(family.newMember() as any) as PlatformMember

            const component = new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(MemberStepView, {
                    title: 'Nieuw lid',
                    member,
                    component: EditMemberGeneralBox,
                    doSave: false,
                    saveHandler: async (navigate: NavigationActions) => {
                        await navigate.show({
                            components: [
                                new ComponentWithProperties(RegisterMemberView, {
                                    member,
                                    choiceHandler: async (group: Group, navigate: NavigationActions) => {
                                        
                                    },
                                })
                            ]
                        })
                    }
                }),
            });

            await present({
                components: [component],
                modalDisplayStyle: "popup"
            });
        }
    }),
]
</script>
