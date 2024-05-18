<template>
    <ModernTableView
        ref="modernTableView" 
        :table-object-fetcher="tableObjectFetcher" 
        :filter-builders="memberWithRegistrationsBlobUIFilterBuilders" 
        :default-sort-direction="SortItemDirection.DESC" 
        :title="title" 
        column-configuration-id="members" 
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
import { Column, ComponentExposed, ModernTableView, TableAction, memberWithRegistrationsBlobUIFilterBuilders, useContext, useTableObjectFetcher } from "@stamhoofd/components";
import { CountFilteredRequest, CountResponse, Group, LimitedFilteredRequest, MembersBlob, PaginatedResponseDecoder, Platform, PlatformFamily, PlatformMember, SortItemDirection, SortList } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Ref, ref } from "vue";
import MemberSegmentedView from './MemberSegmentedView.vue';

type ObjectType = PlatformMember;

const title = 'Leden';
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

const context = useContext();
const present = usePresent();
const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>

function extendSort(list: SortList): SortList  {
    if (list.find(l => l.key === 'id')) {
        return list;
    }

    // Always add id as an extra sort key for sorters that are not unique
    return [...list, {key: 'id', order: list[0]?.order ?? SortItemDirection.ASC}]
}

const tableObjectFetcher = useTableObjectFetcher<PlatformMember>({
    async fetch(data: LimitedFilteredRequest): Promise<{results: ObjectType[], next?: LimitedFilteredRequest}> {
        console.log('Members.fetch', data);
        data.sort = extendSort(data.sort);

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
        compare: (a, b) => Sorter.byStringValue(a, b),
        minimumWidth: 100,
        recommendedWidth: 200,
        grow: true
    }),
    new Column<ObjectType, Date | null>({
        id: 'birthDay',
        name: "Geboortedatum", 
        getValue: (member) => member.member.details.birthDay, 
        compare: (a, b) => Sorter.byDateValue(b ?? new Date(1900), a ?? new Date(1900)),
        format: (date) => date ? Formatter.dateNumber(date, true) : '',
        minimumWidth: 50,
        recommendedWidth: 150,
    }),
    new Column<ObjectType, number | null>({
        id: 'age',
        name: "Leeftijd", 
        getValue: (member) => member.member.details.age, 
        compare: (a, b) => 0,
        format: (age) => age ? Formatter.integer(age) + ' jaar' : 'onbekend',
        minimumWidth: 30,
        recommendedWidth: 100,
    })
];

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
        name: "E-mailen",
        icon: "email",
        priority: 10,
        groupIndex: 1,
        handler: (members: ObjectType[]) => {
            //this.openMail(members)
        }
    }),

    new TableAction({
        name: "Exporteren naar Excel",
        icon: "download",
        priority: 10,
        groupIndex: 1,
        handler: async (members: ObjectType[]) => {
            //await this.exportToExcel(members)
        }
    }),

    new TableAction({
        name: "Bekijken",
        icon: "eye",
        priority: 0,
        groupIndex: 1,
        needsSelection: true,
        singleSelection: true,
        handler: (members: ObjectType[]) => {
            //this.showMember(members[0])
        }
    })
]

// @Component({
//     components: {
//         ModernTableView
//     }
// })
// export default class MembersView extends Mixins(NavigationMixin) {
//     members: MemberSummary[] = [];
//     tableObjectFetcher = new TableObjectFetcher({
//         objectFetcher: new MemberFetcher()
//     })
//     UIFilterBuilders = memberUIFilterBuilders
// 
//     showMember(member: MemberSummary) {
//         console.log("show", member)
//         this.present(new ComponentWithProperties(MemberView, { member: member }).setDisplayStyle("popup"))
//     }
// 
//     get actions(): TableAction<MemberSummary>[] {
//         return [
//             new TableAction({
//                 name: "E-mailen",
//                 icon: "email",
//                 priority: 10,
//                 groupIndex: 1,
//                 handler: (members: MemberSummary[]) => {
//                     this.openMail(members)
//                 }
//             }),
// 
//             new TableAction({
//                 name: "Exporteren naar Excel",
//                 icon: "download",
//                 priority: 10,
//                 groupIndex: 1,
//                 handler: async (members: MemberSummary[]) => {
//                     await this.exportToExcel(members)
//                 }
//             }),
// 
//             new TableAction({
//                 name: "Bekijken",
//                 icon: "eye",
//                 priority: 0,
//                 groupIndex: 1,
//                 needsSelection: true,
//                 singleSelection: true,
//                 handler: (members: MemberSummary[]) => {
//                     this.showMember(members[0])
//                 }
//             })
//         ]
//     }
// 
//     allColumns = ((): Column<MemberSummary, any>[] => {
//         const cols: Column<MemberSummary, any>[] = [
//             new Column<MemberSummary, string>({
//                 id: 'name',
//                 name: "Naam", 
//                 getValue: (member) => member.firstName + " " + member.lastName,
//                 compare: (a, b) => Sorter.byStringValue(a, b),
//                 minimumWidth: 100,
//                 recommendedWidth: 200,
//                 grow: true
//             }),
//             new Column<MemberSummary, Date | null>({
//                 id: 'birthDay',
//                 name: "Geboortedatum", 
//                 getValue: (member) => member.birthDay, 
//                 compare: (a, b) => Sorter.byDateValue(b ?? new Date(1900), a ?? new Date(1900)),
//                 format: (date) => date ? Formatter.dateNumber(date, true) : '',
//                 minimumWidth: 50,
//                 recommendedWidth: 150,
//             }),
//             new Column<MemberSummary, string>({
//                 id: 'organizationName',
//                 name: "Vereniging", 
//                 getValue: (member) => member.organizationName, 
//                 compare: (a, b) => Sorter.byStringValue(a, b),
//                 minimumWidth: 100,
//                 recommendedWidth: 400
//             }),
//             new Column<MemberSummary, string>({
//                 id: 'email',
//                 name: "E-mailadres", 
//                 getValue: (member) => member.email ?? '', 
//                 compare: (a, b) => Sorter.byStringValue(a, b),
//                 minimumWidth: 100,
//                 recommendedWidth: 200,
//                 enabled: false
//             }),
//             new Column<MemberSummary, string>({
//                 id: 'parent-0-email',
//                 name: "E-mailadres ouder 1", 
//                 getValue: (member) => member.parents[0]?.email ?? '', 
//                 compare: (a, b) => Sorter.byStringValue(a, b),
//                 minimumWidth: 100,
//                 recommendedWidth: 200,
//                 enabled: false
//             }),
//             new Column<MemberSummary, Address | null>({
//                 name: "Adres 1", 
//                 getValue: (member) => member.addresses[0] ?? null, 
//                 compare: (a, b) => Sorter.stack(Sorter.byStringValue(a?.city ?? "", b?.city ?? ""), Sorter.byStringValue(a?.street ?? "", b?.street ?? ""), Sorter.byStringValue(a?.number ?? "", b?.number ?? "")),
//                 format: (address) => address?.toString() ?? "",
//                 minimumWidth: 100,
//                 recommendedWidth: 200,
//                 enabled: false
//             }),
//             new Column<MemberSummary, Address | null>({
//                 name: "Adres 2", 
//                 getValue: (member) => member.addresses[1] ?? null, 
//                 compare: (a, b) => Sorter.stack(Sorter.byStringValue(a?.city ?? "", b?.city ?? ""), Sorter.byStringValue(a?.street ?? "", b?.street ?? ""), Sorter.byStringValue(a?.number ?? "", b?.number ?? "")),
//                 format: (address) => address?.toString() ?? "",
//                 minimumWidth: 100,
//                 recommendedWidth: 200,
//                 enabled: false
//             }),
//         ]
//         return cols
//     })()
// 
//     get prefixColumn() {
//         // Needs to stay the same reference to enable disable/enable functionality
//         return null
//     }
// 
//     /*get filterDefinitions(): FilterDefinition<MemberSummary, Filter<MemberSummary>, any>[] {
//         const definitions: FilterDefinition<MemberSummary, Filter<MemberSummary>, any>[] = [
//             new StringFilterDefinition<MemberSummary>({
//                 id: "member_organization", 
//                 name: "Naam vereniging", 
//                 getValue: (member) => {
//                     return member.organizationName
//                 }
//             }),
//             new StringFilterDefinition<MemberSummary>({
//                 id: "member_name", 
//                 name: "Naam lid", 
//                 getValue: (member) => {
//                     return member.firstName + " " + member.lastName
//                 }
//             }),
//             new NumberFilterDefinition<MemberSummary>({
//                 id: "member_age", 
//                 name: "Leeftijd", 
//                 getValue: (member) => {
//                     return member.age ?? 99
//                 },
//                 floatingPoint: false
//             }),
//             new DateFilterDefinition<MemberSummary>({
//                 id: "member_birthDay", 
//                 name: "Geboortedatum", 
//                 getValue: (member) => {
//                     return member.birthDay ?? new Date(1900, 0, 1)
//                 },
//                 time: false
//             }),
//             new StringFilterDefinition<MemberSummary>({
//                 id: "member_city", 
//                 name: "Gemeente", 
//                 description: "Gemeente van het eerste adres van het lid",
//                 getValue: (member) => {
//                     return member.addresses[0]?.city ?? ""
//                 }
//             }),
//             new ChoicesFilterDefinition<MemberSummary>({
//                 id: "gender", 
//                 name: "Geslacht", 
//                 choices: [
//                     new ChoicesFilterChoice(Gender.Male, "Man"),
//                     new ChoicesFilterChoice(Gender.Female, "Vrouw"),
//                     new ChoicesFilterChoice(Gender.Other, "Andere"),
//                 ], 
//                 getValue: (member) => {
//                     return [member.gender]
//                 },
//                 defaultMode: ChoicesFilterMode.Or
//             }),
// 
//             new ChoicesFilterDefinition<MemberSummary>({
//                 id: "member_missing_data", 
//                 name: "Ontbrekende gegevens", 
//                 description: "Toon leden als één van de geselecteerde gegevens ontbreekt of niet is ingevuld.",
//                 choices: [
//                     new ChoicesFilterChoice("birthDay", "Geboortedatum"),
//                     new ChoicesFilterChoice("address", "Adres", "Van lid zelf"),
//                     new ChoicesFilterChoice("phone", "Telefoonnummer", "Van lid zelf"),
//                     new ChoicesFilterChoice("email", "E-mailadres", "Van lid zelf"),
//                     new ChoicesFilterChoice("parents", "Ouders"),
//                     new ChoicesFilterChoice("secondParent", "Tweede ouder", "Als er maar één ouder is toegevoegd aan een lid. Handig om te selecteren op een eenoudergezin."),
//                 ], 
//                 getValue: (member) => {
//                     const missing: string[] = []
//                     if (!member.birthDay) {
//                         missing.push("birthDay")
//                     }
// 
//                     if (!member.address) {
//                         missing.push("address")
//                     }
// 
//                     if (!member.phone) {
//                         missing.push("phone")
//                     }
// 
//                     if (!member.email) {
//                         missing.push("email")
//                     }
// 
//                     if (member.parents.length == 0) {
//                         missing.push("parents")
//                     }
// 
//                     if (member.parents.length == 1) {
//                         missing.push("secondParent")
//                     }
// 
//                     return missing
//                 },
//                 defaultMode: ChoicesFilterMode.Or
//             })
//         ];
// 
//         return definitions
//     }*/
// 
//     get title() {
//         return "Leden"
//     }
// 
//     async exportToExcel(members: MemberSummary[]) {
//         const displayedComponent = new ComponentWithProperties(NavigationController, {
//             root: await LoadComponent(() => import(/* webpackChunkName: "AdminMemberExcelBuilderView"*/ './MemberExcelBuilderView.vue'), {
//                 members
//             })
//         });
//         this.present(displayedComponent.setDisplayStyle("popup"));
//     }
// 
//     openMail(members: MemberSummary[]) {
//         const emails = members.flatMap(member => {
//             return member.emailRecipients
//         })
//         
//         const displayedComponent = new ComponentWithProperties(NavigationController, {
//             root: new ComponentWithProperties(MailView, {
//                 members: members,
//                 otherRecipients: emails,
//                 defaultSubject: "",
//                 defaultReplacements: []
//             })
//         });
//         this.present(displayedComponent.setDisplayStyle("popup"));
//     }
// }
// 
</script>
