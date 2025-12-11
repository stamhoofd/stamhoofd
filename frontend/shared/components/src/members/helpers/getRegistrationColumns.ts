import { Column } from '@stamhoofd/components';
import { ContextPermissions } from '@stamhoofd/networking';
import { AppType, ContinuousMembershipStatus, Group, GroupCategoryTree, GroupType, MembershipStatus, Organization, PermissionLevel, Platform, PlatformRegistration, RecordAnswer, RegisterItemOption } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';

type ObjectType = PlatformRegistration;

export function getRegistrationColumns({ organization, dateRange, group, groups, filterPeriodId, auth, category, app, waitingList, financialRead }: { organization: Organization | null; dateRange?: { start: Date; end: Date } | null; group?: Group | null; groups: Group[]; filterPeriodId: string; periodId?: string | null; auth: ContextPermissions; category?: GroupCategoryTree | null; app: AppType | 'auto'; waitingList: boolean | null; financialRead: boolean }) {
    const allColumns: Column<ObjectType, any>[] = [
        new Column<ObjectType, string>({
            id: 'member.memberNumber',
            name: '#',
            getValue: registration => registration.member.member.details.memberNumber ?? '',
            getStyle: val => val ? '' : 'gray',
            format: val => val ? val : $t(`60abecdc-9f60-4e4a-a994-95e3fec67a5a`),
            minimumWidth: 100,
            recommendedWidth: 150,
            grow: true,
            allowSorting: true,
            enabled: false,
        }),

        new Column<ObjectType, string>({
            id: 'member.name',
            name: $t(`522fb6c5-6d4d-4d9c-94b7-3e282fb0ea1f`),
            getValue: registration => registration.member.member.name,
            minimumWidth: 100,
            recommendedWidth: 200,
            grow: true,
        }),

        new Column<ObjectType, Date | null>({
            id: 'member.birthDay',
            name: $t(`7d7b5a21-105a-41a1-b511-8639b59024a4`),
            getValue: registration => registration.member.member.details.birthDay,
            format: date => date ? Formatter.dateNumber(date, true) : '',
            minimumWidth: 50,
            recommendedWidth: 170,
            enabled: false,
        }),
        new Column<ObjectType, number | null>({
            id: 'member.age',
            name: $t(`992b79e9-8c6e-4096-aa59-9e5f546eac41`),
            getValue: registration => registration.member.member.details.age,
            format: (age, width) => age ? (width <= 60 ? Formatter.integer(age) : (Formatter.integer(age) + ' ' + $t(`ba6f46a9-2598-4da2-beb2-fdf9ba890bfd`))) : $t(`af93c340-950c-4f6c-be6a-6bb847ec2d41`),
            minimumWidth: 50,
            recommendedWidth: 120,
            enabled: false,
        }),
        new Column<ObjectType, { status: MembershipStatus; hasFutureMembership: boolean }>({
            id: 'member.membership',
            name: $t(`c7d995f1-36a0-446e-9fcf-17ffb69f3f45`),
            getValue: (registration) => {
                return {
                    status: registration.member.membershipStatus,
                    hasFutureMembership: registration.member.hasFutureMembership,
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
            enabled: false,
        }),
        dateRange !== null
            ? new Column<ObjectType, ContinuousMembershipStatus>({
                id: 'member.continuousMembership',
                name: 'Doorlopende aansluiting',
                getValue: registration => registration.member.getContinuousMembershipStatus(dateRange!),
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
            getValue: registration => registration.member.getResponsibilities({ organization: organization ?? undefined }).map(l => l.getName(registration.member, false)),
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
            getValue: registration => registration.member.patchedMember.users.filter(u => u.hasAccount).map(u => u.email),
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

    // do not show if only 1 price
    if (!group || !(group && group.settings.prices.length < 2)) {
        allColumns.push(new Column<ObjectType, string>({
            id: 'groupPrice',
            allowSorting: true,
            name: $t('a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc'),
            getValue: registration => registration.groupPrice.name.toString(),
            minimumWidth: 100,
            recommendedWidth: 300,
            enabled: !!group,
        }));
    }

    if (group) {
        for (const optionMenu of group.settings.optionMenus) {
            allColumns.push(
                new Column<ObjectType, RegisterItemOption | null>({
                    id: 'optionMenu-' + optionMenu.id,
                    allowSorting: false,
                    name: optionMenu.name,
                    getValue: (registration) => {
                        const option = registration.options.find(o => o.optionMenu.id === optionMenu.id);
                        if (!option) {
                            return null;
                        }
                        return option;
                    },
                    format: (value) => {
                        if (value === null) {
                            return $t(`60abecdc-9f60-4e4a-a994-95e3fec67a5a`);
                        }
                        return value.option.allowAmount || value.amount > 1 ? (value.amount + 'x ' + value.option.name) : value.option.name;
                    },
                    getStyle: value => value === null ? 'gray' : '',
                    minimumWidth: 100,
                    recommendedWidth: 200,
                }),
            );
        }

        for (const category of group.settings.recordCategories) {
            for (const record of category.getAllRecords()) {
                allColumns.push(
                    new Column<ObjectType, RecordAnswer | null>({
                        id: 'record-' + record.id,
                        allowSorting: false,
                        name: record.name.toString(),
                        getValue: (registration) => {
                            const answer = registration.recordAnswers.get(record.id);
                            if (answer) {
                                return answer;
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
                getValue: (registration) => {
                    const base: string[] = [];
                    const scope = {
                        scopeGroups: groups,
                        checkPermissions: {
                            user: auth.user!,
                            level: PermissionLevel.Read,
                        },
                        scopeOrganization: organization,
                    };

                    const member = registration.member;
                    const details = registration.member.patchedMember.details;

                    // Check missing information
                    if (!details.phone && member.isPropertyRequired('phone', scope)) {
                        base.push($t(`de723a38-6e76-418a-a6f6-52c6ed45c5c8`));
                    }

                    if (!details.email && member.isPropertyRequired('emailAddress', scope)) {
                        base.push($t(`64163c88-2610-4542-9fd4-db523670049c`));
                    }

                    if (!details.address && member.isPropertyRequired('address', scope)) {
                        base.push($t(`ca287035-d735-4eaa-bbb3-ae0db435b4ea`));
                    }

                    if (!details.birthDay && member.isPropertyRequired('birthDay', scope)) {
                        base.push($t(`88a24a2b-d84a-4c7e-978d-6180e260a06f`));
                    }

                    if (!details.nationalRegisterNumber && member.isPropertyRequired('nationalRegisterNumber', scope)) {
                        base.push($t(`e7a21ff5-4f90-4518-8279-ea4fb747fb66`));
                    }
                    else {
                        if (member.isPropertyRequired('parents', scope) && member.isPropertyRequired('nationalRegisterNumber', scope) && !member.patchedMember.details.parents.find(p => p.nationalRegisterNumber)) {
                            base.push($t(`af59b3e6-e47c-4c9f-a571-2e1662f17114`));
                        }
                    }

                    if (member.isPropertyRequired('parents', scope)) {
                        if (details.parents.length === 0) {
                            base.push($t(`8a5dfcff-bbe3-4b8f-8b6d-85df4d35dc94`));
                        }
                    }

                    if (details.emergencyContacts.length === 0 && member.isPropertyRequired('emergencyContacts', scope)) {
                        base.push($t(`d42f4d7d-a453-403b-9b3f-459020fc8849`));
                    }

                    const { categories: enabledCategories } = member.getEnabledRecordCategories(scope);

                    const incomplete = enabledCategories.filter(c => !c.isComplete(registration));
                    return [...base, ...incomplete.map(c => c.name.toString())];
                },
                format: prices => Formatter.capitalizeFirstLetter(Formatter.joinLast(prices, ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') || $t('e41660ea-180a-45ef-987c-e780319c4331')),
                getStyle: prices => prices.length === 0 ? 'gray' : '',
                minimumWidth: 100,
                recommendedWidth: 300,
                enabled: false,
            }),
        );
    }

    if (app === 'admin' || (group && group.settings.requireOrganizationIds.length !== 1 && group.type === GroupType.EventRegistration && auth.hasSomePlatformAccess())) {
        allColumns.push(
            new Column<ObjectType, Organization | undefined>({
                id: 'organization.name',
                allowSorting: true,
                name: $t('2f325358-6e2f-418c-9fea-31a14abbc17a'),
                getValue: registration => registration.member.family.getOrganization(registration.group.organizationId),
                format: organization => organization?.name ?? $t('836c2cd3-32a3-43f2-b09c-600170fcd9cb'),
                getStyle: organization => !organization ? 'gray' : '',
                minimumWidth: 100,
                recommendedWidth: 300,
                enabled: app === 'admin',
            }),
        );

        allColumns.push(
            new Column<ObjectType, Organization | undefined>({
                id: 'organization.uri',
                allowSorting: true,
                name: $t('9d283cbb-7ba2-4a16-88ec-ff0c19f39674'),
                getValue: registration => registration.member.family.getOrganization(registration.group.organizationId),
                format: organization => organization?.uri ?? $t('836c2cd3-32a3-43f2-b09c-600170fcd9cb'),
                getStyle: organization => !organization ? 'gray' : '',
                minimumWidth: 50,
                recommendedWidth: 100,
                enabled: false,
            }),
        );
    }

    // Who has paid?
    if (group && group.type === GroupType.EventRegistration && group.settings.allowRegistrationsByOrganization) {
        allColumns.push(
            new Column<ObjectType, string | null>({
                id: 'groupRegistration',
                allowSorting: false,
                name: $t('7289b10e-a284-40ea-bc57-8287c6566a82'),
                getValue: (registration) => {
                    if (registration.payingOrganizationId) {
                        const organization = registration.member.organizations.find(o => o.id === registration.payingOrganizationId);
                        return organization ? organization.name : $t(`bd1e59c8-3d4c-4097-ab35-0ce7b20d0e50`);
                    }
                    return null;
                },
                format: organizationName => organizationName || $t(`b8b730fb-f1a3-4c13-8ec4-0aebe08a1449`),
                getStyle: organizationName => organizationName === null ? 'gray' : '',
                minimumWidth: 100,
                recommendedWidth: 300,
                enabled: false,
            }),
        );
    }

    if (groups.find(g => g.settings.trialDays)) {
        allColumns.push(
            new Column<ObjectType, Date | null>({
                id: 'trialUntil',
                name: $t(`47c7c3c4-9246-40b7-b1e0-2cb408d5f79e`),
                allowSorting: true,
                getValue: (registration) => {
                    if (registration.trialUntil && registration.trialUntil > new Date()) {
                        return new Date(registration.trialUntil.getTime());
                    }
                    return null;
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
            id: 'startDate',
            name: $t(`bbe0af99-b574-4719-a505-ca2285fa86e4`),
            allowSorting: true,
            getValue: (registration) => {
                const startDate = registration.startDate;
                if (startDate === null) {
                    return null;
                }

                return new Date(startDate.getTime());
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
            id: 'registeredAt',
            name: waitingList ? $t(`2a96fc1f-3710-4eae-bd01-b95ef8c2622b`) : $t(`8895f354-658f-48bd-9d5d-2e0203ca2a36`),
            allowSorting: true,
            getValue: registration => registration.registeredAt,
            format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`bd1e59c8-3d4c-4097-ab35-0ce7b20d0e50`),
            getStyle: v => v === null ? 'gray' : '',
            minimumWidth: 80,
            recommendedWidth: 220,
        }),
    );

    if (!waitingList && financialRead) {
        allColumns.push(
            new Column<ObjectType, number>({
                name: $t(`6f3104d4-9b8f-4946-8434-77202efae9f0`),
                // todo?
                allowSorting: false,
                getValue: (registration) => {
                    return registration.balances.reduce((sum, r) => sum + (r.amountOpen + r.amountPaid + r.amountPending), 0);
                },
                format: (outstandingBalance) => {
                    if (outstandingBalance < 0) {
                        return Formatter.price(outstandingBalance);
                    }
                    if (outstandingBalance <= 0) {
                        return $t(`30e129d7-349d-4369-a8c4-c86b82ce2e01`);
                    }
                    return Formatter.price(outstandingBalance);
                },
                getStyle: v => v === 0 ? 'gray' : (v < 0 ? 'negative' : ''),
                minimumWidth: 70,
                recommendedWidth: 80,
                enabled: false,
            }),
        );

        allColumns.push(
            new Column<ObjectType, number>({
                name: $t(`3a97e6cb-012d-4007-9c54-49d3e5b72909`),
                description: $t('7a8d174e-2807-4ada-ad94-6f519edc9c14'),
                // todo?
                allowSorting: false,
                getValue: (registration) => {
                    return registration.balances.reduce((sum, r) => sum + (r.amountOpen + r.amountPending), 0);
                },
                format: (outstandingBalance) => {
                    if (outstandingBalance < 0) {
                        return Formatter.price(outstandingBalance);
                    }
                    if (outstandingBalance <= 0) {
                        return $t(`885254e1-4bd2-40be-a1aa-4c60e592b9b9`);
                    }
                    return Formatter.price(outstandingBalance);
                },
                getStyle: v => v === 0 ? 'gray' : (v < 0 ? 'negative' : ''),
                minimumWidth: 70,
                recommendedWidth: 120,
                enabled: false,
            }),
        );
    }

    if (organization !== null) {
        allColumns.push(
            new Column<ObjectType, number>({
                id: 'cachedBalance.amountOpen',
                name: $t(`beb45452-dee7-4a7f-956c-e6db06aac20f`),
                description: $t('6c5de33a-dbbd-4b9c-866d-104e007836b3'),
                allowSorting: true,
                getValue: v => v.member.member.balances.reduce((sum, r) => sum + (r.amountOpen), 0),
                format: (outstandingBalance) => {
                    return Formatter.price(outstandingBalance);
                },
                getStyle: v => v === 0 ? 'gray' : (v < 0 ? 'negative' : ''),
                minimumWidth: 70,
                recommendedWidth: 200,
                enabled: false,
            }),
        );
    }

    if (category) {
        allColumns.push(
            new Column<ObjectType, Group[]>({
                id: 'category',
                allowSorting: false,
                name: waitingList ? $t(`a1608b0c-760b-4de1-9616-dea65c812437`) : (category.settings.name || $t('b467444b-879a-4bce-b604-f7e890008c4f')),
                getValue: (registration) => {
                    if (!category) {
                        return [];
                    }
                    const groups = category.getAllGroups();
                    const memberGroups = registration.member.filterGroups({ groups: groups, periodId: filterPeriodId });
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

    if (!group) {
        allColumns.push(...[
            new Column<ObjectType, string | null>({
                id: 'group.defaultAgeGroup',
                // todo?
                allowSorting: false,
                name: $t('aa592704-705f-47f8-97ed-805b46c87e40'),
                getValue: (registration) => {
                    return registration.group.defaultAgeGroupId;
                },
                format: (g) => {
                    if (!g) {
                        return $t('3ef9e622-426f-4913-89a0-0ce08f4542d4');
                    }
                    return Platform.shared.config.defaultAgeGroups.find(a => a.id === g)?.name.toString() || $t('836c2cd3-32a3-43f2-b09c-600170fcd9cb');
                },
                getStyle: g => !g ? 'gray' : '',
                minimumWidth: 100,
                recommendedWidth: 300,
                enabled: !group,
            }),
            new Column<ObjectType, Group>({
                id: 'group.name',
                allowSorting: true,
                name: $t('c3d036e9-60ec-48e1-85a8-e801dc305466'),
                getValue: (registration) => {
                    return registration.group;
                },
                format: (g) => {
                    return g.settings.name.toString();
                },
                minimumWidth: 100,
                recommendedWidth: 300,
                enabled: !group,
            }),
        ]);
    }

    return allColumns.filter(column => column !== null);
}
