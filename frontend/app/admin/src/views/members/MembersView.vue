<template>
    <ModernTableView ref="table" :table-object-fetcher="tableObjectFetcher" :UIFilterBuilders="UIFilterBuilders" :prefix-column="prefixColumn" default-sort-direction="DESC" :title="title" column-configuration-id="members" :actions="actions" :all-columns="allColumns" @click="showMember">
        <template #empty>
            Er zijn nog geen leden.
        </template>
    </ModernTableView>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Column, GroupUIFilterBuilder, LoadComponent, ModernTableView, ObjectFetcher, StringFilterBuilder, TableAction, TableObjectFetcher, UIFilter, UIFilterBuilder, UIFilterBuilders } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Address, ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode, CountFilteredRequest, CountResponse, DateFilterDefinition, Filter, FilterDefinition, Gender, LimitedFilteredRequest, MemberSummary, NumberFilterDefinition, PaginatedResponseDecoder, SortItemDirection, SortList, StringFilterDefinition } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "../../classes/AdminSession";
import MailView from "../mail/MailView.vue";
import MemberView from "./MemberView.vue";

const memberUIFilterBuilders: UIFilterBuilders = [
    new StringFilterBuilder({
        name: 'Naam',
        key: 'name'
    }),
    new StringFilterBuilder({
        name: 'Naam vereniging',
        key: 'organizationName'
    }),
    new StringFilterBuilder({
        name: 'E-mailadres lid',
        key: 'email'
    }),
    new StringFilterBuilder({
        name: 'E-mailadres ouder',
        key: 'parentEmail'
    }),
    new StringFilterBuilder({
        name: 'Inschrijvingsgroepen',
        key: 'name',
        wrapFilter: (f) => {
            return {
                registrations: {
                    $elemMatch: [
                        {
                            group: f
                        }
                    ]
                }
            }
        }
    }),
];

// Recursive: self referencing groups
memberUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: memberUIFilterBuilders
    })
)

class MemberFetcher implements ObjectFetcher<MemberSummary> {
    extendSort(list: SortList): SortList {
        if (list.find(l => l.key === 'id')) {
            return list;
        }

        // Always add id as an extra sort key for sorters that are not unique
        return [...list, {key: 'id', order: list[0]?.order ?? SortItemDirection.ASC}]
    }

    destroy() {
        Request.cancelAll(this)
    }

    async fetch(data: LimitedFilteredRequest): Promise<{results: MemberSummary[], next?: LimitedFilteredRequest}> {
        console.log('Members.fetch', data);
        data.sort = this.extendSort(data.sort);

        const response = await AdminSession.shared.authenticatedServer.request({
            method: "GET",
            path: "/members",
            decoder: new PaginatedResponseDecoder(MemberSummary as Decoder<MemberSummary>, LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            query: data,
            shouldRetry: false,
            owner: this
        })

        console.log('[Done] Members.fetch', data, response.data);
        return response.data;
    }

    async fetchCount(data: CountFilteredRequest): Promise<number> {
        console.log('Members.fetchCount', data);

         const response = await AdminSession.shared.authenticatedServer.request({
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
}

@Component({
    components: {
        ModernTableView
    }
})
export default class MembersView extends Mixins(NavigationMixin) {
    members: MemberSummary[] = [];
    tableObjectFetcher = new TableObjectFetcher({
        objectFetcher: new MemberFetcher()
    })
    UIFilterBuilders = memberUIFilterBuilders

    mounted() {
        UrlHelper.setUrl("/members")    
        document.title = "Leden - Stamhoofd"
    }

    showMember(member: MemberSummary) {
        console.log("show", member)
        this.present(new ComponentWithProperties(MemberView, { member: member }).setDisplayStyle("popup"))
    }

    get actions(): TableAction<MemberSummary>[] {
        return [
            new TableAction({
                name: "E-mailen",
                icon: "email",
                priority: 10,
                groupIndex: 1,
                handler: (members: MemberSummary[]) => {
                    this.openMail(members)
                }
            }),

            new TableAction({
                name: "Exporteren naar Excel",
                icon: "download",
                priority: 10,
                groupIndex: 1,
                handler: async (members: MemberSummary[]) => {
                    await this.exportToExcel(members)
                }
            }),

            new TableAction({
                name: "Bekijken",
                icon: "eye",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                handler: (members: MemberSummary[]) => {
                    this.showMember(members[0])
                }
            })
        ]
    }

    allColumns = ((): Column<MemberSummary, any>[] => {
        const cols: Column<MemberSummary, any>[] = [
            new Column<MemberSummary, string>({
                id: 'name',
                name: "Naam", 
                getValue: (member) => member.firstName + " " + member.lastName,
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 200,
                grow: true
            }),
            new Column<MemberSummary, Date | null>({
                id: 'birthDay',
                name: "Geboortedatum", 
                getValue: (member) => member.birthDay, 
                compare: (a, b) => Sorter.byDateValue(b ?? new Date(1900), a ?? new Date(1900)),
                format: (date) => date ? Formatter.dateNumber(date, true) : '',
                minimumWidth: 50,
                recommendedWidth: 150,
            }),
            new Column<MemberSummary, string>({
                id: 'organizationName',
                name: "Vereniging", 
                getValue: (member) => member.organizationName, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 400
            }),
            new Column<MemberSummary, string>({
                id: 'email',
                name: "E-mailadres", 
                getValue: (member) => member.email ?? '', 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 200,
                enabled: false
            }),
            new Column<MemberSummary, string>({
                id: 'parent-0-email',
                name: "E-mailadres ouder 1", 
                getValue: (member) => member.parents[0]?.email ?? '', 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 200,
                enabled: false
            }),
            new Column<MemberSummary, Address | null>({
                name: "Adres 1", 
                getValue: (member) => member.addresses[0] ?? null, 
                compare: (a, b) => Sorter.stack(Sorter.byStringValue(a?.city ?? "", b?.city ?? ""), Sorter.byStringValue(a?.street ?? "", b?.street ?? ""), Sorter.byStringValue(a?.number ?? "", b?.number ?? "")),
                format: (address) => address?.toString() ?? "",
                minimumWidth: 100,
                recommendedWidth: 200,
                enabled: false
            }),
            new Column<MemberSummary, Address | null>({
                name: "Adres 2", 
                getValue: (member) => member.addresses[1] ?? null, 
                compare: (a, b) => Sorter.stack(Sorter.byStringValue(a?.city ?? "", b?.city ?? ""), Sorter.byStringValue(a?.street ?? "", b?.street ?? ""), Sorter.byStringValue(a?.number ?? "", b?.number ?? "")),
                format: (address) => address?.toString() ?? "",
                minimumWidth: 100,
                recommendedWidth: 200,
                enabled: false
            }),
        ]
        return cols
    })()

    get prefixColumn() {
        // Needs to stay the same reference to enable disable/enable functionality
        return null
    }

    /*get filterDefinitions(): FilterDefinition<MemberSummary, Filter<MemberSummary>, any>[] {
        const definitions: FilterDefinition<MemberSummary, Filter<MemberSummary>, any>[] = [
            new StringFilterDefinition<MemberSummary>({
                id: "member_organization", 
                name: "Naam vereniging", 
                getValue: (member) => {
                    return member.organizationName
                }
            }),
            new StringFilterDefinition<MemberSummary>({
                id: "member_name", 
                name: "Naam lid", 
                getValue: (member) => {
                    return member.firstName + " " + member.lastName
                }
            }),
            new NumberFilterDefinition<MemberSummary>({
                id: "member_age", 
                name: "Leeftijd", 
                getValue: (member) => {
                    return member.age ?? 99
                },
                floatingPoint: false
            }),
            new DateFilterDefinition<MemberSummary>({
                id: "member_birthDay", 
                name: "Geboortedatum", 
                getValue: (member) => {
                    return member.birthDay ?? new Date(1900, 0, 1)
                },
                time: false
            }),
            new StringFilterDefinition<MemberSummary>({
                id: "member_city", 
                name: "Gemeente", 
                description: "Gemeente van het eerste adres van het lid",
                getValue: (member) => {
                    return member.addresses[0]?.city ?? ""
                }
            }),
            new ChoicesFilterDefinition<MemberSummary>({
                id: "gender", 
                name: "Geslacht", 
                choices: [
                    new ChoicesFilterChoice(Gender.Male, "Man"),
                    new ChoicesFilterChoice(Gender.Female, "Vrouw"),
                    new ChoicesFilterChoice(Gender.Other, "Andere"),
                ], 
                getValue: (member) => {
                    return [member.gender]
                },
                defaultMode: ChoicesFilterMode.Or
            }),

            new ChoicesFilterDefinition<MemberSummary>({
                id: "member_missing_data", 
                name: "Ontbrekende gegevens", 
                description: "Toon leden als één van de geselecteerde gegevens ontbreekt of niet is ingevuld.",
                choices: [
                    new ChoicesFilterChoice("birthDay", "Geboortedatum"),
                    new ChoicesFilterChoice("address", "Adres", "Van lid zelf"),
                    new ChoicesFilterChoice("phone", "Telefoonnummer", "Van lid zelf"),
                    new ChoicesFilterChoice("email", "E-mailadres", "Van lid zelf"),
                    new ChoicesFilterChoice("parents", "Ouders"),
                    new ChoicesFilterChoice("secondParent", "Tweede ouder", "Als er maar één ouder is toegevoegd aan een lid. Handig om te selecteren op een eenoudergezin."),
                ], 
                getValue: (member) => {
                    const missing: string[] = []
                    if (!member.birthDay) {
                        missing.push("birthDay")
                    }

                    if (!member.address) {
                        missing.push("address")
                    }

                    if (!member.phone) {
                        missing.push("phone")
                    }

                    if (!member.email) {
                        missing.push("email")
                    }

                    if (member.parents.length == 0) {
                        missing.push("parents")
                    }

                    if (member.parents.length == 1) {
                        missing.push("secondParent")
                    }

                    return missing
                },
                defaultMode: ChoicesFilterMode.Or
            })
        ];

        return definitions
    }*/

    get title() {
        return "Leden"
    }

    async exportToExcel(members: MemberSummary[]) {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: await LoadComponent(() => import(/* webpackChunkName: "AdminMemberExcelBuilderView"*/ './MemberExcelBuilderView.vue'), {
                members
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    openMail(members: MemberSummary[]) {
        const emails = members.flatMap(member => {
            return member.emailRecipients
        })
        
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MailView, {
                members: members,
                otherRecipients: emails,
                defaultSubject: "",
                defaultReplacements: []
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }
}
</script>