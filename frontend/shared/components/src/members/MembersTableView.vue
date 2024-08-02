<template>
    <ModernTableView
        ref="modernTableView" 
        :table-object-fetcher="tableObjectFetcher" 
        :filter-builders="filterBuilders" 
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
import { Column, ComponentExposed, InMemoryTableAction, ModernTableView, TableAction, getAdvancedMemberWithRegistrationsBlobUIFilterBuilders, useAppContext, useAuth, useChooseOrganizationMembersForGroup, useContext, useOrganization, usePlatform, useTableObjectFetcher } from "@stamhoofd/components";
import { useTranslate } from "@stamhoofd/frontend-i18n";
import { AccessRight, CountFilteredRequest, CountResponse, Group, GroupCategoryTree, GroupType, LimitedFilteredRequest, MembersBlob, MembershipStatus, Organization, PaginatedResponseDecoder, PlatformFamily, PlatformMember, SortItemDirection, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from "vue";
import { useDirectMemberActions } from "./classes/MemberActionBuilder";
import MemberSegmentedView from './MemberSegmentedView.vue';

type ObjectType = PlatformMember;

const props = withDefaults(
    defineProps<{
        group?: Group | null,
        category?: GroupCategoryTree | null,
        periodId?: string | null
    }>(), {
        group: null,
        category: null,
        periodId: null
    }
)

const waitingList = computed(() => props.group && props.group.type === GroupType.WaitingList)

const filterBuilders = computed(() => {
    return getAdvancedMemberWithRegistrationsBlobUIFilterBuilders(platform.value, {
        user: auth.user,
    })
})
const title = computed(() => {
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
    return 'members-'+app+'-'+(props.group ? '-group-'+props.group.id : '')+ (props.category ? '-category-'+props.category.id : '')
})
const financialRead = computed(() => auth.permissions?.hasAccessRight(AccessRight.MemberReadFinancialData) ?? false)

const groups = (() => {
    if (props.group) {
        return [props.group]
    }
    if (props.category) {
        return props.category.getAllGroups()
    }
    return []
})()

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

function getRequiredFilter(): StamhoofdFilter|null  {
    if (!props.group && !props.category) {
        return null
    }
    
    return {
        'registrations': {
            $elemMatch: props.group ? {
                groupId: props.group.id
            } : {
                groupId: {
                    $in: groups.map(g => g.id)
                }
            }
        }
    }
}

const tableObjectFetcher = useTableObjectFetcher<PlatformMember>({
    requiredFilter: getRequiredFilter(),
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
                platform: platform.value
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
        format: (age, width) => age ? (width <= 60 ? Formatter.integer(age) : (Formatter.integer(age) + ' jaar')) : 'onbekend',
        minimumWidth: 50,
        recommendedWidth: 120,
    }),
    new Column<ObjectType, MembershipStatus>({
        id: 'membership',
        name: "Aansluiting", 
        getValue: (member) => member.membershipStatus, 
        format: (status) => {
            switch (status) {
                case MembershipStatus.Active:
                    return "Actief";
                case MembershipStatus.Expiring:
                    return "Verlopen";
                case MembershipStatus.Temporary:
                    return "Tijdelijk";
                case MembershipStatus.Inactive:
                    return "Niet verzekerd";
            }
        },
        getStyle: (status) => {
            switch (status) {
                case MembershipStatus.Active:
                    return "success";
                case MembershipStatus.Expiring:
                    return "warn";
                case MembershipStatus.Temporary:
                    return "secundary";
                case MembershipStatus.Inactive:
                    return "error";
            }
        },
        minimumWidth: 100,
        recommendedWidth: 120,
    }),
    new Column<ObjectType, string[]>({
        name: "Functies", 
        allowSorting: false,
        getValue: (member) => member.getResponsibilities(organization.value ?? null, true),
        format: (list) => {
            if (list.length === 0) {
                return 'Geen'
            }
            return list.join(', ')
        }, 
        getStyle: (list) => list.length === 0 ? "gray" : "",
        minimumWidth: 100,
        recommendedWidth: 200
    }),
    new Column<ObjectType, string[]>({
        name: "Account", 
        allowSorting: false,
        getValue: (member) => member.patchedMember.users.filter(u => u.hasAccount).map(u => u.email),
        format: (accounts) => {
            if (accounts.length === 0) {
                return 'Geen account'
            }
            return accounts.join(', ')
        }, 
        getStyle: (accounts) => accounts.length === 0 ? "gray" : "",
        minimumWidth: 100,
        recommendedWidth: 200
    })
];

if (app == 'admin') {
    allColumns.push(
        new Column<ObjectType, Organization[]>({
            id: 'organization',
            allowSorting: false,
            name: $t('shared.organization.singular'), 
            getValue: (member) => member.filterOrganizations({periodId: props.periodId ?? props.group?.periodId ?? ''}), 
            format: (organizations) => Formatter.joinLast(organizations.map(o => o.name), ', ', ' en ') || $t('shared.notRegistered'),
            getStyle: (organizations) => organizations.length == 0 ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 300,
        })
    )
} else {
    allColumns.push(
        new Column<ObjectType, Date | null>({
            name: waitingList.value ? "Sinds" : "Inschrijvingsdatum", 
            allowSorting: false,
            getValue: (v) => {
                const registrations = v.filterRegistrations({groups, periodId: props.periodId ?? props.group?.periodId ?? ''})

                if (registrations.length == 0) {
                    return null
                }

                const filtered = registrations.filter(r => r.registeredAt).map(r => r.registeredAt!.getTime())

                if (filtered.length == 0) {
                    return null
                }
                return new Date(Math.min(...filtered))
            }, 
            format: (v, width) => v ? (width < 160 ? (width < 120 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : "Onbekend",
            getStyle: (v) => v === null ? "gray" : "",
            minimumWidth: 80,
            recommendedWidth: 160
        })
    )

    if (!waitingList.value && financialRead.value && organization.value) {
        allColumns.push(
            new Column<ObjectType, number>({
                name: "Openstaand saldo", 
                allowSorting: false,
                getValue: (v) => v.patchedMember.outstandingBalanceFor(organization.value!.id),
                format: (outstandingBalance) => {
                    if (outstandingBalance < 0) {
                        return Formatter.price(outstandingBalance)
                    }
                    if (outstandingBalance <= 0) {
                        return "Betaald";
                    }
                    return Formatter.price(outstandingBalance)
                }, 
                getStyle: (v) => v <= 0 ? "gray" : "",
                minimumWidth: 70,
                recommendedWidth: 80
            })
        )
    }

    if (props.category) {
        allColumns.push(
            new Column<ObjectType, Group[]>({
                id: 'category',
                allowSorting: false,
                name: waitingList.value ? 'Wachtlijst' : (props.category.settings.name || 'Groep'), 
                getValue: (member) => {
                    if (!props.category) {
                        return [];
                    }
                    const groups = props.category.getAllGroups()
                    const registrations = member.filterRegistrations({groups: groups, periodId: props.periodId ?? props.group?.periodId ?? ''})
                    const memberGroups = registrations.flatMap(r => {
                        const group = groups.find(g => g.id == r.groupId)
                        if (!group) {
                            return []
                        }
                        return [group]
                    })
                    const getIndex = (g) => groups.findIndex(_g => _g.id === g.id)
                    return memberGroups.sort((a,b) => Sorter.byNumberValue(getIndex(b), getIndex(a)))
                },
                format: (groups) => {
                    if (groups.length == 0) {
                        return 'Geen'
                    }
                    return groups.map(g => g.settings.name).join(', ')
                }, 
                getStyle: (groups) => groups.length == 0 ? "gray" : "",
                minimumWidth: 100,
                recommendedWidth: 150
            })
        )
    }
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
            group: props.group
        }),
    });

    await present({
        components: [component],
        modalDisplayStyle: "popup"
    });
}

const actionBuilder = useDirectMemberActions({
    groups: props.group ? [props.group] : (props.category ? props.category.getAllGroups() : []),
})

const chooseOrganizationMembersForGroup = useChooseOrganizationMembersForGroup()

const actions: TableAction<PlatformMember>[] = [
    new InMemoryTableAction({
        name: "Leden inschrijven",
        icon: "add",
        priority: 0,
        groupIndex: 1,
        needsSelection: false,
        enabled: (props.group && organization.value ? props.group.hasWriteAccess(auth.permissions, organization.value.period.settings.categories) : false),
        handler: async () => {
            await chooseOrganizationMembersForGroup({
                members: [],
                group: props.group!
            })
        }
    }),
    ...actionBuilder.getActions()
]
</script>
