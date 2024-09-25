<template>
    <ModernTableView
        ref="modernTableView" 
        :table-object-fetcher="tableObjectFetcher" 
        :filter-builders="filterBuilders" 
        :title="title" 
        :column-configuration-id="configurationId" 
        :default-filter="defaultFilter"
        :actions="actions"
        :all-columns="allColumns" 
        @click="showMember"
    >
        <template #empty>
            Geen leden ingeschreven
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from "@simonbackx/vue-app-navigation";
import { Column, ComponentExposed, InMemoryTableAction, ModernTableView, TableAction, getAdvancedMemberWithRegistrationsBlobUIFilterBuilders, useAppContext, useAuth, useChooseOrganizationMembersForGroup, useGlobalEventListener, useOrganization, usePlatform, useTableObjectFetcher } from "@stamhoofd/components";
import { useTranslate } from "@stamhoofd/frontend-i18n";
import { AccessRight, Group, GroupCategoryTree, GroupPrice, GroupType, MemberResponsibility, MembershipStatus, Organization, PlatformMember, RegisterItemOption, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from "vue";
import { useMembersObjectFetcher } from "../fetchers/useMembersObjectFetcher";
import { useDirectMemberActions } from "./classes/MemberActionBuilder";
import MemberSegmentedView from './MemberSegmentedView.vue';

type ObjectType = PlatformMember;

const props = withDefaults(
    defineProps<{
        group?: Group | null,
        category?: GroupCategoryTree | null,
        periodId?: string | null,
        responsibility?: MemberResponsibility | null, // for now only for saving column config
        customFilter?: StamhoofdFilter|null,
        customTitle?: string|null
    }>(), {
        group: null,
        category: null,
        periodId: null,
        customFilter: null,
        customTitle: null,
        responsibility: null
    }
)

const waitingList = computed(() => props.group && props.group.type === GroupType.WaitingList)

const filterBuilders = computed(() => {
    return getAdvancedMemberWithRegistrationsBlobUIFilterBuilders(platform.value, {
        user: auth.user,
    })
})

const title = computed(() => {
    if (props.customTitle) {
        return props.customTitle
    }
    
    if (props.group) {
        return props.group.settings.name
    }

    return 'Leden'
})

const present = usePresent();
const app = useAppContext();
const $t = useTranslate();
const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>
const auth = useAuth();
const organization = useOrganization();
const platform = usePlatform()
const defaultFilter = app === 'admin' ? {
    platformMemberships: {
        $elemMatch: {
            endDate: {
                $gt: {$: '$now'}
            }
        }
    }
} : null;

useGlobalEventListener('members-deleted', async () => {
    tableObjectFetcher.reset(true, true)
})
useGlobalEventListener('members-added', async () => {
    tableObjectFetcher.reset(true, true)
})
useGlobalEventListener('members-registered', async () => {
    tableObjectFetcher.reset(true, true)
})

const configurationId = computed(() => {
    return 'members-'+app+'-org-' + (organization.value?.id ?? 'null')+ '-'+(props.group ? '-group-'+props.group.id : '')+ (props.category ? '-category-'+props.category.id : '') + (props.responsibility ? '-responsibility-'+props.responsibility.id : '')
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

function getRequiredFilter(): StamhoofdFilter|null  {
    if (props.customFilter) {
        return props.customFilter
    }

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

const objectFetcher = useMembersObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string>({
        id: 'memberNumber',
        name: "#", 
        getValue: (member) => member.member.details.memberNumber ?? '',
        getStyle: (val) => val ? '' : 'gray',
        format: (val) => val ? val : 'Geen',
        minimumWidth: 100,
        recommendedWidth: 150,
        grow: true,
        allowSorting: false,
        enabled: false
    }),

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
        allowSorting: false
    }),
    new Column<ObjectType, string[]>({
        name: "Functies", 
        allowSorting: false,
        getValue: (member) => member.getResponsibilities(organization.value ?? null).map(l => l.getName(member, false)),
        format: (list) => {
            if (list.length === 0) {
                return 'Geen'
            }
            return list.join(', ')
        }, 
        getStyle: (list) => list.length === 0 ? "gray" : "",
        minimumWidth: 100,
        recommendedWidth: 200,
        enabled: false
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
        recommendedWidth: 200,
        enabled: false
    })
];

if (props.group) {
    if (props.group.settings.prices.length > 1) {
        allColumns.push(
            new Column<ObjectType, GroupPrice[]>({
                id: 'groupPrice',
                allowSorting: false,
                name: $t('a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc'), 
                getValue: (member) => member.filterRegistrations({groups: [props.group!]}).map(r => r.groupPrice), 
                format: (prices) => Formatter.joinLast(prices.map(o => o.name).sort(), ', ', ' en ') || $t('e41660ea-180a-45ef-987c-e780319c4331'),
                getStyle: (prices) => prices.length === 0 ? 'gray' : '',
                minimumWidth: 100,
                recommendedWidth: 300,
            })
        )
    }
    
    for (const optionMenu of props.group.settings.optionMenus) {
        allColumns.push(
            new Column<ObjectType, RegisterItemOption[]>({
                id: 'optionMenu-'+optionMenu.id,
                allowSorting: false,
                name: optionMenu.name, 
                getValue: (member) => member.filterRegistrations({groups: [props.group!]}).flatMap(r => {
                    const option = r.options.find(o => o.optionMenu.id === optionMenu.id)
                    if (!option) {
                        return []
                    }
                    return [option]
                }),
                format: (values) => {
                    if (values.length === 0) {
                        return 'Geen'
                    }
                    return values.map(v => v.option.allowAmount || v.amount > 1 ? (v.amount + 'x ' + v.option.name) : v.option.name).join(', ')
                }, 
                getStyle: (values) => values.length === 0 ? 'gray' : '',
                minimumWidth: 100,
                recommendedWidth: 200,
            })
        )
    }
}

if (app === 'admin' || (props.group && props.group.settings.requireOrganizationIds.length !== 1 && props.group.type === GroupType.EventRegistration)) {
    allColumns.push(
        new Column<ObjectType, Organization[]>({
            id: 'organization',
            allowSorting: false,
            name: $t('2f325358-6e2f-418c-9fea-31a14abbc17a'), 
            getValue: (member) => member.filterOrganizations({periodId: props.periodId ?? props.group?.periodId ?? platform.value.period.id, types: [GroupType.Membership]}), 
            format: (organizations) => Formatter.joinLast(organizations.map(o => o.name).sort(), ', ', ' en ') || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f'),
            getStyle: (organizations) => organizations.length === 0 ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 300,
        })
    )

    allColumns.push(
        new Column<ObjectType, Organization[]>({
            id: 'uri',
            allowSorting: false,
            name: $t('9d283cbb-7ba2-4a16-88ec-ff0c19f39674'), 
            getValue: (member) => member.filterOrganizations({periodId: props.periodId ?? props.group?.periodId ?? platform.value.period.id, types: [GroupType.Membership]}), 
            format: (organizations) => Formatter.joinLast(organizations.map(o => o.uri).sort(), ', ', ' en ') || $t('e41660ea-180a-45ef-987c-e780319c4331'),
            getStyle: (organizations) => organizations.length === 0 ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 300,
            enabled: false
        })
    )
} else {
    allColumns.push(
        new Column<ObjectType, Date | null>({
            name: waitingList.value ? "Sinds" : "Inschrijvingsdatum", 
            allowSorting: false,
            getValue: (v) => {
                const registrations = v.filterRegistrations({groups, periodId: props.periodId ?? props.group?.periodId ?? ''})

                if (registrations.length === 0) {
                    return null
                }

                const filtered = registrations.filter(r => r.registeredAt).map(r => r.registeredAt!.getTime())

                if (filtered.length === 0) {
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

    if (!waitingList.value && financialRead.value && organization.value && !groups.find(g => g.organizationId !== organization.value!.id)) {
        allColumns.push(
            new Column<ObjectType, number>({
                name: "Prijs", 
                allowSorting: false,
                getValue: (v) => v.filterRegistrations({groups: groups}).reduce((sum, r) => sum + r.price, 0),
                format: (outstandingBalance) => {
                    if (outstandingBalance < 0) {
                        return Formatter.price(outstandingBalance)
                    }
                    if (outstandingBalance <= 0) {
                        return "Gratis";
                    }
                    return Formatter.price(outstandingBalance)
                }, 
                getStyle: (v) => v <= 0 ? "gray" : "",
                minimumWidth: 70,
                recommendedWidth: 80,
                enabled: false
            })
        )

        allColumns.push(
            new Column<ObjectType, number>({
                name: "Te betalen", 
                allowSorting: false,
                getValue: (v) => v.filterRegistrations({groups: groups}).reduce((sum, r) => sum + (r.price - r.pricePaid), 0),
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
                        const group = groups.find(g => g.id === r.groupId)
                        if (!group) {
                            return []
                        }
                        return [group]
                    })
                    const getIndex = (g) => groups.findIndex(_g => _g.id === g.id)
                    return memberGroups.sort((a,b) => Sorter.byNumberValue(getIndex(b), getIndex(a)))
                },
                format: (groups) => {
                    if (groups.length === 0) {
                        return 'Geen'
                    }
                    return groups.map(g => g.settings.name).join(', ')
                }, 
                getStyle: (groups) => groups.length === 0 ? "gray" : "",
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

const actions: TableAction<ObjectType>[] = [
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
