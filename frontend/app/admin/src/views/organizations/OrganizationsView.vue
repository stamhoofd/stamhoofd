<template>
    <ModernTableView ref="table" :table-object-fetcher="tableObjectFetcher" :UIFilterBuilders="UIFilterBuilders" :prefix-column="prefixColumn" :title="title" column-configuration-id="organizations" :actions="actions" :all-columns="allColumns" @click="showOrganization">
        <template #empty>
            Er zijn nog geen verenigingen.
        </template>
    </ModernTableView>
</template>


<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Column, GroupUIFilterBuilder, LoadComponent, ModernTableView, MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption, ObjectFetcher, StringFilterBuilder, TableAction, TableObjectFetcher, TableView, UIFilterBuilders } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { AcquisitionType, CountFilteredRequest, CountResponse, LimitedFilteredRequest, OrganizationOverview, OrganizationType, OrganizationTypeHelper, PaginatedResponseDecoder, Recipient, Replacement, SortItemDirection, SortList, STPackageType, STPackageTypeHelper, UmbrellaOrganization, UmbrellaOrganizationHelper } from "@stamhoofd/structures";
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "../../classes/AdminSession";
import MailView from "../mail/MailView.vue";
import OrganizationView from "./OrganizationView.vue";

const userUIFilterBuilders: UIFilterBuilders = [
    new StringFilterBuilder({
        name: 'Naam',
        key: 'name'
    }),
    new StringFilterBuilder({
        name: 'Voornaam',
        key: 'firstName'
    }),
    new StringFilterBuilder({
        name: 'Achternaam',
        key: 'lastName'
    }),
    new StringFilterBuilder({
        name: 'E-mailadres',
        key: 'email'
    }),
]

const allUIFilterBuilders: UIFilterBuilders = [
    new StringFilterBuilder({
        name: 'Naam',
        key: 'name'
    }),
    new MultipleChoiceFilterBuilder({
        name: 'Pakketten',
        options: [...Object.values(STPackageType)].map(type => {
            return new MultipleChoiceUIFilterOption(STPackageTypeHelper.getName(type), type)
        }),
        buildFilter: (f) => {
            return {
                packages: {
                    $elemMatch: {
                        type: {
                            $in: f
                        }
                    }
                }
            }
        }
    }),
    new MultipleChoiceFilterBuilder({
        name: 'Koepelorganisatie',
        options: [...Object.values(UmbrellaOrganization)].map(type => {
            return new MultipleChoiceUIFilterOption(UmbrellaOrganizationHelper.getName(type), type)
        }),
        buildFilter: (f) => {
            return {
                umbrellaOrganization: {
                    $in: f
                }
            }
        }
    }),
    new MultipleChoiceFilterBuilder({
        name: 'Type',
        options: [...Object.values(OrganizationType)].map(type => {
            return new MultipleChoiceUIFilterOption(OrganizationTypeHelper.getName(type), type)
        }),
        buildFilter: (f) => {
            return {
                type: {
                    $in: f
                }
            }
        }
    }),
    new GroupUIFilterBuilder({
        name: 'Beheerders',
        builders: userUIFilterBuilders,
        wrapFilter: (f) => {
            return {
                users: {
                    $elemMatch: [
                        {
                            permissions: {
                                $neq: null
                            }
                        },
                        f
                    ]
                }
            }
        }
    }),
    new GroupUIFilterBuilder({
        name: 'Gebruiker',
        builders: userUIFilterBuilders,
        wrapFilter: (f) => {
            return {
                users: {
                    $elemMatch: f
                }
            }
        }
    })
];

// Recursive: self referencing groups
allUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: allUIFilterBuilders
    })
)

// Recursive: self referencing groups
userUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: userUIFilterBuilders
    })
)


class Fetcher implements ObjectFetcher<OrganizationOverview> {
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

    async fetch(data: LimitedFilteredRequest) {
        console.log('Organizations.fetch', data);
        data.sort = this.extendSort(data.sort);

        const response = await AdminSession.shared.authenticatedServer.request({
            method: "GET",
            path: "/organizations",
            decoder: new PaginatedResponseDecoder(OrganizationOverview as Decoder<OrganizationOverview>, LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            query: data,
            shouldRetry: false,
            owner: this
        })

        console.log('[Done] Organizations.fetch', data, response.data);
        return response.data;
    }

    async fetchCount(data: CountFilteredRequest): Promise<number> {
        console.log('Organizations.fetchCount', data);

         const response = await AdminSession.shared.authenticatedServer.request({
            method: "GET",
            path: "/organizations-count",
            decoder: CountResponse as Decoder<CountResponse>,
            query: data,
            shouldRetry: false,
            owner: this
        })

        console.log('[Done] Organizations.fetchCount', data, response.data.count);
        return response.data.count
    }
}

@Component({
    components: {
        ModernTableView
    }
})
export default class OrganizationsView extends Mixins(NavigationMixin) {
    organizations: OrganizationOverview[] = [];
    tableObjectFetcher = new TableObjectFetcher({
        objectFetcher: new Fetcher()
    })
    UIFilterBuilders = allUIFilterBuilders

    mounted() {
        UrlHelper.setUrl("/organizations")    
        document.title = "Verenigingen - Stamhoofd"
    }

    showOrganization(organization: OrganizationOverview) {
        const table = this.$refs.table as TableView<OrganizationOverview> | undefined
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(OrganizationView, { 
                        initialOrganization: organization,
                        getNext: table?.getNext,
                        getPrevious: table?.getPrevious,
                    })
                })
            ],
            modalDisplayStyle: "popup",
            animated: true
        })
    }

    get actions(): TableAction<OrganizationOverview>[] {
        return [
            new TableAction({
                name: "E-mailen",
                icon: "email",
                priority: 10,
                groupIndex: 1,
                handler: (organizations: OrganizationOverview[]) => {
                    this.openMail(organizations)
                }
            }),
            new TableAction({
                name: "Exporteren naar Excel",
                icon: "download",
                priority: 10,
                groupIndex: 1,
                handler: async (organizations: OrganizationOverview[]) => {
                    await this.exportToExcel(organizations)
                }
            }),
            new TableAction({
                name: "Bekijken",
                icon: "eye",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                handler: (organizations: OrganizationOverview[]) => {
                    this.showOrganization(organizations[0])
                }
            })
        ]
    }

    allColumns = ((): Column<OrganizationOverview, any>[] => {
        const cols: Column<OrganizationOverview, any>[] = [
            new Column<OrganizationOverview, string>({
                id: 'name',
                name: "Naam", 
                getValue: (organization) => organization.name, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 400,
                grow: true,
            }),
            new Column<OrganizationOverview, string>({
                id: 'city',
                name: "Gemeente", 
                getValue: (organization) => organization.address.city, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 200
            }),
            new Column<OrganizationOverview, string>({
                id: 'country',
                name: "Land", 
                getValue: (organization) => organization.address.country, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 100
            }),
            new Column<OrganizationOverview, string>({
                id: 'type',
                name: "Type", 
                getValue: (organization) => OrganizationTypeHelper.getName(organization.type),
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 150,
                enabled: false
            }),
            new Column<OrganizationOverview, string>({
                id: 'umbrellaOrganization',
                name: "Koepelorganisatie", 
                getValue: (organization) => UmbrellaOrganizationHelper.getName(organization.umbrellaOrganization ?? UmbrellaOrganization.Other),
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 200,
                enabled: false
            }),
            new Column<OrganizationOverview, Date>({
                id: 'createdAt',
                name: "Geregistreerd op", 
                getValue: (organization) => organization.createdAt,
                compare: (a, b) => Sorter.byDateValue(a, b),
                format: (date) => Formatter.dateTime(date),
                minimumWidth: 100,
                recommendedWidth: 200,
                enabled: false
            }),
            new Column<OrganizationOverview, AcquisitionType[]>({
                id: 'acquisitionTypes',
                name: "Geregistreerd via", 
                getValue: (organization) => organization.acquisitionTypes,
                compare: (a, b) => Sorter.byStringValue(a[0] ?? '', b[0] ?? ''),
                format: (date) => date.join(", "),
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

    get cities(): [string, string][] {
        const cities = new Map<string, string>()
        for (const org of this.organizations) {
            cities.set(Formatter.slug(org.address.city), org.address.city)
        }

        return [...cities.entries()].sort((a, b) => Sorter.byStringValue(a[0], b[0]))
    }

    /*get filterDefinitions(): FilterDefinition<OrganizationOverview, Filter<OrganizationOverview>, any>[] {
        const definitions: FilterDefinition<OrganizationOverview, Filter<OrganizationOverview>, any>[] = []

        definitions.push(
            new ChoicesFilterDefinition<OrganizationOverview>({
                id: "country",
                name: "Land",
                choices: CountryHelper.getList().map(({value, text}) => {
                    return new ChoicesFilterChoice(value, text)
                }),
                defaultMode: ChoicesFilterMode.Or,
                getValue: (org) => {
                    return [org.address.country]
                }
            }),
            new ChoicesFilterDefinition<OrganizationOverview>({
                id: "city",
                name: "Gemeente",
                choices: this.cities.map(([id, city]) => {
                    return new ChoicesFilterChoice(id, city)
                }),
                defaultMode: ChoicesFilterMode.Or,
                getValue: (org) => {
                    return [Formatter.slug(org.address.city)]
                }
            }),
            new ChoicesFilterDefinition<OrganizationOverview>({
                id: "type",
                name: "Type",
                choices: Object.values(OrganizationType).map((u) => {
                    return new ChoicesFilterChoice(u, OrganizationTypeHelper.getName(u))
                }),
                defaultMode: ChoicesFilterMode.Or,
                getValue: (org) => {
                    return [org.type ?? OrganizationType.Other]
                }
            }),
            new ChoicesFilterDefinition<OrganizationOverview>({
                id: "umbrellaOrganization",
                name: "Koepelorganisatie",
                choices: Object.values(UmbrellaOrganization).map((u) => {
                    return new ChoicesFilterChoice(u, UmbrellaOrganizationHelper.getName(u))
                }),
                defaultMode: ChoicesFilterMode.Or,
                getValue: (org) => {
                    return [org.umbrellaOrganization ?? UmbrellaOrganization.Other]
                }
            }),
            new DateFilterDefinition<OrganizationOverview>({
                id: "created_at",
                name: "Aanmaakdatum",
                time: false,
                getValue: (organization) => {
                    return organization.createdAt
                }
            }),
            new NumberFilterDefinition<OrganizationOverview>({
                id: "member_count",
                name: "Ledenaantal",
                getValue: (organization) => {
                    return organization.stats.memberCount
                }
            }),
            new ChoicesFilterDefinition<OrganizationOverview>({
                id: "payment_providers",
                name: "Betaalproviders",
                choices: Object.values(PaymentProvider).map((u) => {
                    return new ChoicesFilterChoice(u, u.toString())
                }),
                defaultMode: ChoicesFilterMode.Or,
                getValue: (org) => {
                    return org.features
                }
            }),
            new ChoicesFilterDefinition<OrganizationOverview>({
                id: "packages",
                name: "Pakketten",
                choices: Object.values(STPackageType).map((u) => {
                    return new ChoicesFilterChoice(u, STPackageTypeHelper.getName(u))
                }),
                defaultMode: ChoicesFilterMode.Or,
                getValue: (org) => {
                    return [...org.packages.packages.keys()].filter(p => org.packages.isActive(p))
                }
            }),
            new ChoicesFilterDefinition<OrganizationOverview>({
                id: "acquisition_types",
                name: "Geregistreerd via",
                choices: Object.values(AcquisitionType).map((u) => {
                    return new ChoicesFilterChoice(u, u.toString())
                }),
                defaultMode: ChoicesFilterMode.Or,
                getValue: (org) => {
                    return org.acquisitionTypes
                }
            })
        )

        return definitions
    }*/

    get title() {
        return "Verenigingen"
    }

    async exportToExcel(organizations: OrganizationOverview[]) {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: await LoadComponent(() => import(/* webpackChunkName: "OrganizationsExcelBuilderView"*/ './OrganizationsExcelBuilderView.vue'), {
                organizations
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    openMail(organizations: OrganizationOverview[]) {
        const emails = organizations.flatMap(o => {
            const filteredAdmins = o.admins.filter(a => (a.permissions?.hasFullAccess([]) ?? false) && a.firstName && a.verified)

            return filteredAdmins.map(a => {
                return Recipient.create({
                    firstName: a.firstName,
                    email: a.email,
                    replacements: [
                        Replacement.create({
                            token: "firstName",
                            value: a.firstName ?? ""
                        }),
                        Replacement.create({
                            token: "lastName",
                            value: a.lastName ?? ""
                        }),
                        Replacement.create({
                            token: "email",
                            value: a.email ?? ""
                        }),
                        Replacement.create({
                            token: "organization",
                            value: o.name ?? ""
                        })
                    ],
                    userId: a?.id,
                });
            })
        })
        
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MailView, {
                organizations: organizations,
                otherRecipients: emails,
                defaultSubject: "",
                defaultReplacements: []
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }
}
</script>