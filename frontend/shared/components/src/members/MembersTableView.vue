<template>
    <LoadingViewTransition>
        <ModernTableView v-if="!loading" ref="modernTableView" :table-object-fetcher="tableObjectFetcher" :filter-builders="filterBuilders" :title="title" :column-configuration-id="configurationId" :default-filter="defaultFilter" :actions="actions" :all-columns="allColumns" :estimated-rows="estimatedRows" :Route="Route">
            <template #empty>
                {{ $t('22f14cbd-ccaf-41a7-a7ca-15272d6203b9') }}
            </template>
        </ModernTableView>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncTableAction, Column, ComponentExposed, InMemoryTableAction, LoadingViewTransition, ModernTableView, TableAction, TableActionSelection, useAdvancedMemberWithRegistrationsBlobUIFilterBuilders, useAppContext, useAuth, useChooseOrganizationMembersForGroup, useGlobalEventListener, useOrganization, usePlatform, useTableObjectFetcher } from '@stamhoofd/components';
import { AccessRight, ContinuousMembershipStatus, Group, GroupCategoryTree, GroupPrice, GroupType, MemberResponsibility, MembershipStatus, Organization, PermissionLevel, PlatformMember, RecordAnswer, RegisterItemOption, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import { useMembersObjectFetcher } from '../fetchers/useMembersObjectFetcher';
import ChargeMembersView from './ChargeMembersView.vue';
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
        dateRange?: { start: Date; end: Date } | null;
    }>(), {
        group: null,
        category: null,
        periodId: null,
        customFilter: null,
        customTitle: null,
        responsibility: null,
        dateRange: null,
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

    return $t(`fb35c140-e936-4e91-aa92-ef4dfc59fb51`);
});

const estimatedRows = computed(() => {
    if (props.group) {
        return props.group.settings.registeredMembers;
    }
    return 30;
});

const app = useAppContext();

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const auth = useAuth();
const organization = useOrganization();
const platform = usePlatform();
const present = usePresent();
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
        format: val => val ? val : $t(`60abecdc-9f60-4e4a-a994-95e3fec67a5a`),
        minimumWidth: 100,
        recommendedWidth: 150,
        grow: true,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, string>({
        id: 'name',
        name: $t(`522fb6c5-6d4d-4d9c-94b7-3e282fb0ea1f`),
        getValue: member => member.member.name,
        minimumWidth: 100,
        recommendedWidth: 200,
        grow: true,
    }),
    new Column<ObjectType, Date | null>({
        id: 'birthDay',
        name: $t(`7d7b5a21-105a-41a1-b511-8639b59024a4`),
        getValue: member => member.member.details.birthDay,
        format: date => date ? Formatter.dateNumber(date, true) : '',
        minimumWidth: 50,
        recommendedWidth: 170,
        enabled: false,
    }),
    new Column<ObjectType, number | null>({
        id: 'age',
        name: $t(`992b79e9-8c6e-4096-aa59-9e5f546eac41`),
        getValue: member => member.member.details.age,
        format: (age, width) => age ? (width <= 60 ? Formatter.integer(age) : (Formatter.integer(age) + ' ' + $t(`ba6f46a9-2598-4da2-beb2-fdf9ba890bfd`))) : $t(`af93c340-950c-4f6c-be6a-6bb847ec2d41`),
        minimumWidth: 50,
        recommendedWidth: 120,
    }),
    new Column<ObjectType, { status: MembershipStatus; hasFutureMembership: boolean }>({
        id: 'membership',
        name: $t(`c7d995f1-36a0-446e-9fcf-17ffb69f3f45`),
        getValue: (member) => {
            return {
                status: member.membershipStatus,
                hasFutureMembership: member.hasFutureMembership,
            };
        },
        format: ({ status }) => {
            switch (status) {
                case MembershipStatus.Trial:
                    return $t(`47c7c3c4-9246-40b7-b1e0-2cb408d5f79e`);
                case MembershipStatus.Active:
                    return $t(`b56351e9-4847-4a0c-9eec-348d75c794c4`);
                case MembershipStatus.Expiring:
                    return $t(`d9858110-37d9-4b4a-8bfb-d76b3cc5ef27`);
                case MembershipStatus.Temporary:
                    return $t(`75e62d3c-f348-4104-8a1e-e11e6e7fbe32`);
                case MembershipStatus.Inactive:
                    return $t(`1f8620fa-e8a5-4665-99c8-c1907a5b5768`);
            }
        },
        getStyle: ({ status, hasFutureMembership }) => {
            switch (status) {
                case MembershipStatus.Trial:
                    return 'secundary';
                case MembershipStatus.Active:
                    return 'success';
                case MembershipStatus.Expiring:
                    return 'warn';
                case MembershipStatus.Temporary:
                    return 'secundary';
                case MembershipStatus.Inactive: {
                    if (hasFutureMembership) {
                        return 'warn';
                    }

                    return 'error';
                }
            }
        },
        minimumWidth: 120,
        recommendedWidth: 140,
        allowSorting: false,
    }),
    props.dateRange !== null
        ? new Column<ObjectType, ContinuousMembershipStatus>({
            id: 'continuousMembership',
            name: 'Doorlopende aansluiting',
            getValue: member => member.getContinuousMembershipStatus(props.dateRange!),
            format: (status) => {
                switch (status) {
                    case ContinuousMembershipStatus.Full:
                        return 'Volledig';
                    case ContinuousMembershipStatus.Partial:
                        return 'Gedeeltelijk';
                    case ContinuousMembershipStatus.None:
                        return 'Geen aansluiting';
                }
            },
            getStyle: (status) => {
                switch (status) {
                    case ContinuousMembershipStatus.Full:
                        return 'success';
                    case ContinuousMembershipStatus.Partial:
                        return 'warn';
                    case ContinuousMembershipStatus.None:
                        return 'error';
                }
            },
            minimumWidth: 120,
            recommendedWidth: 140,
            allowSorting: false,
            enabled: false,
        })
        : null,
    new Column<ObjectType, string[]>({
        name: $t(`d0defb77-0a25-4b85-a03e-57569c5edf6c`),
        allowSorting: false,
        getValue: member => member.getResponsibilities({ organization: organization.value ?? undefined }).map(l => l.getName(member, false)),
        format: (list) => {
            if (list.length === 0) {
                return $t(`60abecdc-9f60-4e4a-a994-95e3fec67a5a`);
            }
            return list.join(', ');
        },
        getStyle: list => list.length === 0 ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 200,
        enabled: false,
    }),
    new Column<ObjectType, string[]>({
        name: $t(`d84503e9-7d0e-4c4b-a3ca-92bfbed6ca49`),
        allowSorting: false,
        getValue: member => member.patchedMember.users.filter(u => u.hasAccount).map(u => u.email),
        format: (accounts) => {
            if (accounts.length === 0) {
                return $t(`e7592781-8be0-4912-8628-e611e88431ba`);
            }
            return accounts.join(', ');
        },
        getStyle: accounts => accounts.length === 0 ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 200,
        enabled: false,
    }),
].filter(column => column !== null);

if (props.group) {
    if (props.group.settings.prices.length > 1) {
        allColumns.push(
            new Column<ObjectType, GroupPrice[]>({
                id: 'groupPrice',
                allowSorting: false,
                name: $t('a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc'),
                getValue: member => member.filterRegistrations({ groups: [props.group!] }).map(r => r.groupPrice),
                format: prices => Formatter.joinLast(prices.map(o => o.name).sort(), ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') || $t('e41660ea-180a-45ef-987c-e780319c4331'),
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
                        return $t(`60abecdc-9f60-4e4a-a994-95e3fec67a5a`);
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
                            return $t(`3d71ea5d-244b-493e-ba2a-6644dea74b30`);
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
                    base.push($t(`de723a38-6e76-418a-a6f6-52c6ed45c5c8`));
                }

                if (!member.patchedMember.details.email && member.isPropertyRequired('emailAddress', scope)) {
                    base.push($t(`64163c88-2610-4542-9fd4-db523670049c`));
                }

                if (!member.patchedMember.details.address && member.isPropertyRequired('address', scope)) {
                    base.push($t(`ca287035-d735-4eaa-bbb3-ae0db435b4ea`));
                }

                if (!member.patchedMember.details.birthDay && member.isPropertyRequired('birthDay', scope)) {
                    base.push($t(`88a24a2b-d84a-4c7e-978d-6180e260a06f`));
                }

                if (!member.patchedMember.details.nationalRegisterNumber && member.isPropertyRequired('nationalRegisterNumber', scope)) {
                    base.push($t(`e7a21ff5-4f90-4518-8279-ea4fb747fb66`));
                }
                else {
                    if (member.isPropertyRequired('parents', scope) && member.isPropertyRequired('nationalRegisterNumber', scope) && !member.patchedMember.details.parents.find(p => p.nationalRegisterNumber)) {
                        base.push($t(`af59b3e6-e47c-4c9f-a571-2e1662f17114`));
                    }
                }

                if (member.isPropertyRequired('parents', scope)) {
                    if (member.patchedMember.details.parents.length === 0) {
                        base.push($t(`8a5dfcff-bbe3-4b8f-8b6d-85df4d35dc94`));
                    }
                }

                if (member.patchedMember.details.emergencyContacts.length === 0 && member.isPropertyRequired('emergencyContacts', scope)) {
                    base.push($t(`d42f4d7d-a453-403b-9b3f-459020fc8849`));
                }

                const enabledCategories = member.getEnabledRecordCategories(scope);

                const incomplete = enabledCategories.filter(c => !c.isComplete(member));
                return [...base, ...incomplete.map(c => c.name)];
            },
            format: prices => Formatter.capitalizeFirstLetter(Formatter.joinLast(prices, ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') || $t('e41660ea-180a-45ef-987c-e780319c4331')),
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
            format: organizations => Formatter.joinLast(organizations.map(o => o.name).sort(), ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f'),
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
            format: organizations => Formatter.joinLast(organizations.map(o => o.uri).sort(), ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') || $t('e41660ea-180a-45ef-987c-e780319c4331'),
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
                    return organization ? organization.name : $t(`bd1e59c8-3d4c-4097-ab35-0ce7b20d0e50`);
                }
                return null;
            },
            format: organizations => organizations || $t(`b8b730fb-f1a3-4c13-8ec4-0aebe08a1449`),
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
            name: $t(`47c7c3c4-9246-40b7-b1e0-2cb408d5f79e`),
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
                    return $t(`60abecdc-9f60-4e4a-a994-95e3fec67a5a`);
                }
                return $t(`68860bdb-dad1-40d5-9130-6219c83fe977`) + ' ' + (width < 200 ? Formatter.dateNumber(v) : Formatter.date(v));
            },
            getStyle: v => v === null ? 'gray' : 'secundary',
            minimumWidth: 80,
            recommendedWidth: 160,
        }),
    );
}

allColumns.push(
    new Column<ObjectType, Date | null>({
        name: $t(`bbe0af99-b574-4719-a505-ca2285fa86e4`),
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
        format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`bd1e59c8-3d4c-4097-ab35-0ce7b20d0e50`),
        getStyle: v => v === null ? 'gray' : '',
        minimumWidth: 80,
        recommendedWidth: 200,
        enabled: false,
    }),
);

allColumns.push(
    new Column<ObjectType, Date | null>({
        name: waitingList.value ? $t(`2a96fc1f-3710-4eae-bd01-b95ef8c2622b`) : $t(`8895f354-658f-48bd-9d5d-2e0203ca2a36`),
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
        format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`bd1e59c8-3d4c-4097-ab35-0ce7b20d0e50`),
        getStyle: v => v === null ? 'gray' : '',
        minimumWidth: 80,
        recommendedWidth: 200,
    }),
);

if (!waitingList.value && financialRead.value) {
    allColumns.push(
        new Column<ObjectType, number>({
            name: $t(`6f3104d4-9b8f-4946-8434-77202efae9f0`),
            allowSorting: false,
            getValue: v => v.filterRegistrations({ groups: groups }).flatMap(r => r.balances).reduce((sum, r) => sum + (r.amountOpen + r.amountPaid + r.amountPending), 0),
            format: (outstandingBalance) => {
                if (outstandingBalance < 0) {
                    return Formatter.price(outstandingBalance);
                }
                if (outstandingBalance <= 0) {
                    return $t(`30e129d7-349d-4369-a8c4-c86b82ce2e01`);
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
            name: $t(`3a97e6cb-012d-4007-9c54-49d3e5b72909`),
            allowSorting: false,
            getValue: v => v.filterRegistrations({ groups: groups }).flatMap(r => r.balances).reduce((sum, r) => sum + (r.amountOpen), 0),
            format: (outstandingBalance) => {
                if (outstandingBalance < 0) {
                    return Formatter.price(outstandingBalance);
                }
                if (outstandingBalance <= 0) {
                    return $t(`885254e1-4bd2-40be-a1aa-4c60e592b9b9`);
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
            name: waitingList.value ? $t(`a1608b0c-760b-4de1-9616-dea65c812437`) : (props.category.settings.name || $t('b467444b-879a-4bce-b604-f7e890008c4f')),
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
                    return $t(`60abecdc-9f60-4e4a-a994-95e3fec67a5a`);
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
                    return $t(`60abecdc-9f60-4e4a-a994-95e3fec67a5a`);
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

// registrations for events of another organization should not be editable
const excludeEdit = props.group && props.group.type === GroupType.EventRegistration && !!organization.value && props.group.organizationId !== organization.value.id;

const actions: TableAction<ObjectType>[] = [
    new InMemoryTableAction({
        name: $t(`162644a1-aee8-497b-b837-04abb995047f`),
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
    ...actionBuilder.getActions({ selectedOrganizationRegistrationPeriod: organizationRegistrationPeriod.value, includeMove: true, includeEdit: !excludeEdit }),
];

if (app !== 'admin' && auth.canManagePayments()) {
    actions.push(new AsyncTableAction({
        name: $t(`d799bffc-fd09-4444-abfa-3552b3c46cb9`),
        icon: 'calculator',
        priority: 13,
        groupIndex: 4,
        handler: async (selection: TableActionSelection<ObjectType>) => {
            await present({
                modalDisplayStyle: 'popup',
                components: [
                    new ComponentWithProperties(ChargeMembersView, {
                        filter: selection.filter.filter,
                        organization: organization.value!,
                    }),
                ],
            });
        },
    }));
}
</script>
