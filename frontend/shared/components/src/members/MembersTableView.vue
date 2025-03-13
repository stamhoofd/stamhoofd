<template>
    <LoadingViewTransition>
        <ModernTableView
            v-if="!loading"
            ref="modernTableView"
            :table-object-fetcher="tableObjectFetcher"
            :filter-builders="filterBuilders"
            :title="title"
            :column-configuration-id="configurationId"
            :default-filter="defaultFilter"
            :actions="actions"
            :all-columns="allColumns"
            :estimated-rows="estimatedRows"
            :Route="Route"
        >
            <template #empty>
                Geen leden ingeschreven
            </template>
        </ModernTableView>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { Column, ComponentExposed, InMemoryTableAction, LoadingViewTransition, ModernTableView, TableAction, useAdvancedMemberWithRegistrationsBlobUIFilterBuilders, useAppContext, useAuth, useChooseOrganizationMembersForGroup, useGlobalEventListener, useOrganization, usePlatform, useTableObjectFetcher } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { AccessRight, Group, GroupCategoryTree, GroupPrice, GroupType, MemberResponsibility, MembershipStatus, Organization, PermissionLevel, PlatformMember, RecordAnswer, RegisterItemOption, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import { useMembersObjectFetcher } from '../fetchers/useMembersObjectFetcher';
import { useDirectMemberActions } from './classes/MemberActionBuilder';
import MemberSegmentedView from './MemberSegmentedView.vue';

type ObjectType = PlatformMember;

const props = withDefaults(
    defineProps<{
        group?: Group | null;
        category?: GroupCategoryTree | null;
        periodId?: string | null;
        responsibility?: MemberResponsibility | null; // for now only for saving column config
        customFilter?: StamhoofdFilter | null;
        customTitle?: string | null;
    }>(), {
        group: null,
        category: null,
        periodId: null,
        customFilter: null,
        customTitle: null,
        responsibility: null,
    },
);

const waitingList = computed(() => props.group && props.group.type === GroupType.WaitingList);

const { filterBuilders, loading } = useAdvancedMemberWithRegistrationsBlobUIFilterBuilders();

const title = computed(() => {
    if (props.customTitle) {
        return props.customTitle;
    }

    if (props.group) {
        return props.group.settings.name;
    }

    return 'Leden';
});

const estimatedRows = computed(() => {
    if (props.group) {
        return props.group.settings.registeredMembers;
    }
    return 30;
});

const app = useAppContext();
const $t = useTranslate();
const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const auth = useAuth();
const organization = useOrganization();
const platform = usePlatform();
const filterPeriodId = props.periodId ?? props.group?.periodId ?? organization?.value?.period?.period?.id ?? platform.value.period.id;
const defaultFilter = app === 'admin' && !props.group
    ? {
            platformMemberships: {
                $elemMatch: {
                    endDate: {
                        $gt: { $: '$now' },
                    },
                },
            },
        }
    : null;

const organizationRegistrationPeriod = computed(() => {
    const periodId = filterPeriodId;

    return organization.value?.periods?.organizationPeriods?.find(p => p.period.id === periodId);
});

useGlobalEventListener('members-deleted', async () => {
    tableObjectFetcher.reset(true, true);
});
useGlobalEventListener('members-added', async () => {
    tableObjectFetcher.reset(true, true);
});
useGlobalEventListener('members-registered', async () => {
    tableObjectFetcher.reset(true, true);
});
useGlobalEventListener('paymentPatch', async () => {
    tableObjectFetcher.reset(true, true);
});

const configurationId = computed(() => {
    return 'members-' + app + '-org-' + (organization.value?.id ?? 'null') + '-' + (props.group ? '-group-' + props.group.id : '') + (props.category ? '-category-' + props.category.id : '') + (props.responsibility ? '-responsibility-' + props.responsibility.id : '');
});
const financialRead = computed(() => auth.permissions?.hasAccessRight(AccessRight.MemberReadFinancialData) ?? false);

const groups = (() => {
    if (props.group) {
        return [props.group];
    }
    if (props.category) {
        return props.category.getAllGroups();
    }
    return [];
})();

function getRequiredFilter(): StamhoofdFilter | null {
    if (props.customFilter) {
        return props.customFilter;
    }

    if (!props.group && !props.category) {
        if (organization.value && props.periodId) {
            // Only show members that are registered in the current period AND in this group
            // (avoid showing old members that moved to other groups)
            return {
                registrations: {
                    $elemMatch: {
                        organizationId: organization.value.id,
                        periodId: props.periodId,
                    },
                },
            };
        }

        if (props.periodId) {
            return {
                registrations: {
                    $elemMatch: {
                        periodId: props.periodId,
                    },
                },
            };
        }
        return null;
    }

    const extra: StamhoofdFilter[] = [];

    if (organization.value && props.group && props.group.organizationId !== organization.value?.id) {
        // Only show members that are registered in the current period AND in this group
        // (avoid showing old members that moved to other groups)
        const periodIds = [props.group.periodId];
        if (props.periodId) {
            periodIds.push(props.periodId);
        }
        if (organization?.value?.period?.period?.id) {
            periodIds.push(organization.value.period.period.id);
        }
        if (platform.value.period.id) {
            periodIds.push(platform.value.period.id);
        }

        extra.push({
            registrations: {
                $elemMatch: {
                    organizationId: organization.value.id,
                    periodId: {
                        $in: Formatter.uniqueArray(periodIds),
                    },
                },
            },
        });
    }

    return [
        {
            registrations: {
                $elemMatch: props.group
                    ? {
                            groupId: props.group.id,
                        }
                    : {
                            groupId: {
                                $in: groups.map(g => g.id),
                            },
                        },
            },
        },
        ...extra,
    ];
}

const objectFetcher = useMembersObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string>({
        id: 'memberNumber',
        name: '#',
        getValue: member => member.member.details.memberNumber ?? '',
        getStyle: val => val ? '' : 'gray',
        format: val => val ? val : 'Geen',
        minimumWidth: 100,
        recommendedWidth: 150,
        grow: true,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, string>({
        id: 'name',
        name: 'Naam',
        getValue: member => member.member.name,
        minimumWidth: 100,
        recommendedWidth: 200,
        grow: true,
    }),
    new Column<ObjectType, Date | null>({
        id: 'birthDay',
        name: 'Geboortedatum',
        getValue: member => member.member.details.birthDay,
        format: date => date ? Formatter.dateNumber(date, true) : '',
        minimumWidth: 50,
        recommendedWidth: 170,
        enabled: false,
    }),
    new Column<ObjectType, number | null>({
        id: 'age',
        name: 'Leeftijd',
        getValue: member => member.member.details.age,
        format: (age, width) => age ? (width <= 60 ? Formatter.integer(age) : (Formatter.integer(age) + ' jaar')) : 'onbekend',
        minimumWidth: 50,
        recommendedWidth: 120,
    }),
    new Column<ObjectType, MembershipStatus>({
        id: 'membership',
        name: 'Aansluiting',
        getValue: member => member.membershipStatus,
        format: (status) => {
            switch (status) {
                case MembershipStatus.Trial:
                    return 'Proefperiode';
                case MembershipStatus.Active:
                    return 'Actief';
                case MembershipStatus.Expiring:
                    return 'Verlopen';
                case MembershipStatus.Temporary:
                    return 'Tijdelijk';
                case MembershipStatus.Inactive:
                    return 'Niet verzekerd';
            }
        },
        getStyle: (status) => {
            switch (status) {
                case MembershipStatus.Trial:
                    return 'secundary';
                case MembershipStatus.Active:
                    return 'success';
                case MembershipStatus.Expiring:
                    return 'warn';
                case MembershipStatus.Temporary:
                    return 'secundary';
                case MembershipStatus.Inactive:
                    return 'error';
            }
        },
        minimumWidth: 120,
        recommendedWidth: 140,
        allowSorting: false,
    }),
    new Column<ObjectType, string[]>({
        name: 'Functies',
        allowSorting: false,
        getValue: member => member.getResponsibilities({ organization: organization.value ?? undefined }).map(l => l.getName(member, false)),
        format: (list) => {
            if (list.length === 0) {
                return 'Geen';
            }
            return list.join(', ');
        },
        getStyle: list => list.length === 0 ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 200,
        enabled: false,
    }),
    new Column<ObjectType, string[]>({
        name: 'Account',
        allowSorting: false,
        getValue: member => member.patchedMember.users.filter(u => u.hasAccount).map(u => u.email),
        format: (accounts) => {
            if (accounts.length === 0) {
                return 'Geen account';
            }
            return accounts.join(', ');
        },
        getStyle: accounts => accounts.length === 0 ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 200,
        enabled: false,
    }),
];

if (props.group) {
    if (props.group.settings.prices.length > 1) {
        allColumns.push(
            new Column<ObjectType, GroupPrice[]>({
                id: 'groupPrice',
                allowSorting: false,
                name: $t('a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc'),
                getValue: member => member.filterRegistrations({ groups: [props.group!] }).map(r => r.groupPrice),
                format: prices => Formatter.joinLast(prices.map(o => o.name).sort(), ', ', ' en ') || $t('e41660ea-180a-45ef-987c-e780319c4331'),
                getStyle: prices => prices.length === 0 ? 'gray' : '',
                minimumWidth: 100,
                recommendedWidth: 300,
            }),
        );
    }

    for (const optionMenu of props.group.settings.optionMenus) {
        allColumns.push(
            new Column<ObjectType, RegisterItemOption[]>({
                id: 'optionMenu-' + optionMenu.id,
                allowSorting: false,
                name: optionMenu.name,
                getValue: member => member.filterRegistrations({ groups: [props.group!] }).flatMap((r) => {
                    const option = r.options.find(o => o.optionMenu.id === optionMenu.id);
                    if (!option) {
                        return [];
                    }
                    return [option];
                }),
                format: (values) => {
                    if (values.length === 0) {
                        return 'Geen';
                    }
                    return values.map(v => v.option.allowAmount || v.amount > 1 ? (v.amount + 'x ' + v.option.name) : v.option.name).join(', ');
                },
                getStyle: values => values.length === 0 ? 'gray' : '',
                minimumWidth: 100,
                recommendedWidth: 200,
            }),
        );
    }

    for (const category of props.group.settings.recordCategories) {
        for (const record of category.getAllRecords()) {
            allColumns.push(
                new Column<ObjectType, RecordAnswer | null>({
                    id: 'record-' + record.id,
                    allowSorting: false,
                    name: record.name,
                    getValue: (member) => {
                        for (const registration of member.filterRegistrations({ groups: [props.group!] })) {
                            const answer = registration.recordAnswers.get(record.id);
                            if (answer) {
                                return answer;
                            }
                        }
                        return null;
                    },
                    format: (answer) => {
                        if (answer === null) {
                            return 'Ontbreekt';
                        }
                        return answer.stringValue;
                    },
                    getStyle: answer => answer === null || answer.isEmpty ? 'gray' : '',
                    minimumWidth: 100,
                    recommendedWidth: 200,
                    enabled: false,
                }),
            );
        }
    }
}

if (groups.length) {
    allColumns.push(
        new Column<ObjectType, string[]>({
            id: 'missing-record-categories',
            allowSorting: false,
            name: $t('2011b902-ec2f-4c5a-a98a-6e50a1351fae'),
            getValue: (member) => {
                const base: string[] = [];
                const scope = {
                    scopeGroups: groups,
                    checkPermissions: {
                        user: auth.user!,
                        level: PermissionLevel.Read,
                    },
                };

                // Check missing information
                if (!member.patchedMember.details.phone && member.isPropertyRequired('phone', scope)) {
                    base.push('telefoonnummer');
                }

                if (!member.patchedMember.details.email && member.isPropertyRequired('emailAddress', scope)) {
                    base.push('e-mailadres');
                }

                if (!member.patchedMember.details.address && member.isPropertyRequired('address', scope)) {
                    base.push('adres');
                }

                if (!member.patchedMember.details.birthDay && member.isPropertyRequired('birthDay', scope)) {
                    base.push('geboortedatum');
                }

                if (!member.patchedMember.details.nationalRegisterNumber && member.isPropertyRequired('nationalRegisterNumber', scope)) {
                    base.push('rijksregisternummer');
                }
                else {
                    if (member.isPropertyRequired('parents', scope) && member.isPropertyRequired('nationalRegisterNumber', scope) && !member.patchedMember.details.parents.find(p => p.nationalRegisterNumber)) {
                        base.push('rijksregisternummer ouders');
                    }
                }

                if (member.isPropertyRequired('parents', scope)) {
                    if (member.patchedMember.details.parents.length === 0) {
                        base.push('ouders');
                    }
                }

                if (member.patchedMember.details.emergencyContacts.length === 0 && member.isPropertyRequired('emergencyContacts', scope)) {
                    base.push('noodcontactpersonen');
                }

                const enabledCategories = member.getEnabledRecordCategories(scope);

                const incomplete = enabledCategories.filter(c => !c.isComplete(member));
                return [...base, ...incomplete.map(c => c.name)];
            },
            format: prices => Formatter.capitalizeFirstLetter(Formatter.joinLast(prices, ', ', ' en ') || $t('e41660ea-180a-45ef-987c-e780319c4331')),
            getStyle: prices => prices.length === 0 ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 300,
            enabled: false,
        }),
    );
}

if (app === 'admin' || (props.group && props.group.settings.requireOrganizationIds.length !== 1 && props.group.type === GroupType.EventRegistration && auth.hasSomePlatformAccess())) {
    allColumns.push(
        new Column<ObjectType, Organization[]>({
            id: 'organization',
            allowSorting: false,
            name: $t('2f325358-6e2f-418c-9fea-31a14abbc17a'),
            getValue: member => member.filterOrganizations({ periodId: filterPeriodId, types: [GroupType.Membership] }),
            format: organizations => Formatter.joinLast(organizations.map(o => o.name).sort(), ', ', ' en ') || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f'),
            getStyle: organizations => organizations.length === 0 ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 300,
            enabled: app === 'admin',
        }),
    );

    allColumns.push(
        new Column<ObjectType, Organization[]>({
            id: 'uri',
            allowSorting: false,
            name: $t('9d283cbb-7ba2-4a16-88ec-ff0c19f39674'),
            getValue: member => member.filterOrganizations({ periodId: filterPeriodId, types: [GroupType.Membership] }),
            format: organizations => Formatter.joinLast(organizations.map(o => o.uri).sort(), ', ', ' en ') || $t('e41660ea-180a-45ef-987c-e780319c4331'),
            getStyle: organizations => organizations.length === 0 ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 300,
            enabled: false,
        }),
    );
}

// Who has paid?
if (props.group && props.group.type === GroupType.EventRegistration && props.group.settings.allowRegistrationsByOrganization) {
    allColumns.push(
        new Column<ObjectType, string | null>({
            id: 'groupRegistration',
            allowSorting: false,
            name: $t('7289b10e-a284-40ea-bc57-8287c6566a82'),
            getValue: (member) => {
                const registrations = member.filterRegistrations({ groups, periodId: filterPeriodId });
                if (registrations.find(r => r.payingOrganizationId)) {
                    const organization = member.organizations.find(o => o.id === registrations[0].payingOrganizationId);
                    return organization ? organization.name : 'Onbekend';
                }
                return null;
            },
            format: organizations => organizations || 'Nee',
            getStyle: organizations => organizations === null ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 300,
            enabled: false,
        }),
    );
}

if (groups.find(g => g.settings.trialDays)) {
    allColumns.push(
        new Column<ObjectType, Date | null>({
            name: 'Proefperiode',
            allowSorting: false,
            getValue: (v) => {
                const registrations = v.filterRegistrations({ groups, periodId: props.periodId ?? props.group?.periodId ?? '' });

                if (registrations.length === 0) {
                    return null;
                }

                const now = new Date();
                const filtered = registrations.filter(r => r.trialUntil && r.trialUntil > now).map(r => r.trialUntil!.getTime());

                if (filtered.length === 0) {
                    return null;
                }
                return new Date(Math.min(...filtered));
            },
            format: (v, width) => {
                if (!v) {
                    return 'Geen';
                }
                return 'Tot ' + (width < 200 ? Formatter.dateNumber(v) : Formatter.date(v));
            },
            getStyle: v => v === null ? 'gray' : 'secundary',
            minimumWidth: 80,
            recommendedWidth: 160,
        }),
    );
}

allColumns.push(
    new Column<ObjectType, Date | null>({
        name: 'Startdatum',
        allowSorting: false,
        getValue: (v) => {
            const registrations = v.filterRegistrations({ groups, periodId: filterPeriodId });

            if (registrations.length === 0) {
                return null;
            }

            const filtered = registrations.filter(r => r.startDate).map(r => r.startDate!.getTime());

            if (filtered.length === 0) {
                return null;
            }
            return new Date(Math.min(...filtered));
        },
        format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : 'Onbekend',
        getStyle: v => v === null ? 'gray' : '',
        minimumWidth: 80,
        recommendedWidth: 200,
        enabled: false,
    }),
);

allColumns.push(
    new Column<ObjectType, Date | null>({
        name: waitingList.value ? 'Sinds' : 'Inschrijvingsdatum',
        allowSorting: false,
        getValue: (v) => {
            const registrations = v.filterRegistrations({ groups, periodId: filterPeriodId });

            if (registrations.length === 0) {
                return null;
            }

            const filtered = registrations.filter(r => r.registeredAt).map(r => r.registeredAt!.getTime());

            if (filtered.length === 0) {
                return null;
            }
            return new Date(Math.min(...filtered));
        },
        format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : 'Onbekend',
        getStyle: v => v === null ? 'gray' : '',
        minimumWidth: 80,
        recommendedWidth: 200,
    }),
);

if (!waitingList.value && financialRead.value) {
    allColumns.push(
        new Column<ObjectType, number>({
            name: 'Prijs',
            allowSorting: false,
            getValue: v => v.filterRegistrations({ groups: groups }).flatMap(r => r.balances).reduce((sum, r) => sum + (r.amountOpen + r.amountPaid + r.amountPending), 0),
            format: (outstandingBalance) => {
                if (outstandingBalance < 0) {
                    return Formatter.price(outstandingBalance);
                }
                if (outstandingBalance <= 0) {
                    return 'Gratis';
                }
                return Formatter.price(outstandingBalance);
            },
            getStyle: v => v <= 0 ? 'gray' : '',
            minimumWidth: 70,
            recommendedWidth: 80,
            enabled: false,
        }),
    );

    allColumns.push(
        new Column<ObjectType, number>({
            name: 'Te betalen',
            allowSorting: false,
            getValue: v => v.filterRegistrations({ groups: groups }).flatMap(r => r.balances).reduce((sum, r) => sum + (r.amountOpen), 0),
            format: (outstandingBalance) => {
                if (outstandingBalance < 0) {
                    return Formatter.price(outstandingBalance);
                }
                if (outstandingBalance <= 0) {
                    return 'Betaald';
                }
                return Formatter.price(outstandingBalance);
            },
            getStyle: v => v <= 0 ? 'gray' : '',
            minimumWidth: 70,
            recommendedWidth: 80,
            enabled: false,
        }),
    );
}

if (props.category) {
    allColumns.push(
        new Column<ObjectType, Group[]>({
            id: 'category',
            allowSorting: false,
            name: waitingList.value ? 'Wachtlijst' : (props.category.settings.name || $t('b467444b-879a-4bce-b604-f7e890008c4f')),
            getValue: (member) => {
                if (!props.category) {
                    return [];
                }
                const groups = props.category.getAllGroups();
                const memberGroups = member.filterGroups({ groups: groups, periodId: filterPeriodId });
                const getIndex = g => groups.findIndex(_g => _g.id === g.id);
                return memberGroups.sort((a, b) => Sorter.byNumberValue(getIndex(b), getIndex(a)));
            },
            format: (groups) => {
                if (groups.length === 0) {
                    return 'Geen';
                }
                return groups.map(g => g.settings.name).join(', ');
            },
            getStyle: groups => groups.length === 0 ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 300,
            enabled: false,
        }),
    );
}

if (!props.group && !props.category) {
    allColumns.push(
        new Column<ObjectType, Group[]>({
            id: 'category',
            allowSorting: false,
            name: $t('b467444b-879a-4bce-b604-f7e890008c4f'),
            getValue: (member) => {
                let memberGroups = member.filterGroups({ periodId: filterPeriodId, types: [GroupType.Membership, GroupType.WaitingList] });
                if (app === 'admin') {
                    memberGroups = memberGroups.filter(g => g.defaultAgeGroupId !== null);
                }
                return memberGroups.sort((a, b) => Sorter.byStringValue(a.settings.name, b.settings.name));
            },
            format: (groups) => {
                if (groups.length === 0) {
                    return 'Geen';
                }
                return groups.map(g => g.settings.name).join(', ');
            },
            getStyle: groups => groups.length === 0 ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 300,
            enabled: false,
        }),
    );
}

const Route = {
    Component: MemberSegmentedView,
    objectKey: 'member',
    getProperties: () => ({
        group: props.group,
    }),
};

const actionBuilder = useDirectMemberActions({
    groups: props.group ? [props.group] : (props.category ? props.category.getAllGroups() : []),
});

const chooseOrganizationMembersForGroup = useChooseOrganizationMembersForGroup();
let canAdd = (props.group ? auth.canRegisterMembersInGroup(props.group) : false);
if (!organization.value) {
    // For now not possible via admin panel
    canAdd = false;
}

const actions: TableAction<ObjectType>[] = [
    new InMemoryTableAction({
        name: 'Leden inschrijven',
        icon: 'add',
        priority: 0,
        groupIndex: 1,
        needsSelection: false,
        enabled: canAdd,
        handler: async () => {
            await chooseOrganizationMembersForGroup({
                members: [],
                group: props.group!,
            });
        },
    }),
    ...actionBuilder.getActions({ selectedOrganizationRegistrationPeriod: organizationRegistrationPeriod.value }),
];
</script>
