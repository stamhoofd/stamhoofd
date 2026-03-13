import { Column } from '#tables/classes/Column.ts';
import { ContextPermissions } from '@stamhoofd/networking';
import { AppType, ContinuousMembershipStatus, getGroupTypeName, Group, GroupCategoryTree, GroupType, MembershipStatus, Organization, PermissionLevel, Platform, PlatformRegistration, RecordAnswer, RegisterItemOption } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';

type ObjectType = PlatformRegistration;

export function getRegistrationColumns({ organization, dateRange, group, groups, filterPeriodId, auth, category, app, waitingList, financialRead }: { organization: Organization | null; dateRange?: { start: Date; end: Date } | null; group?: Group | null; groups: Group[]; filterPeriodId: string; periodId?: string | null; auth: ContextPermissions; category?: GroupCategoryTree | null; app: AppType | 'auto'; waitingList: boolean | null; financialRead: boolean }) {
    const allColumns: (Column<ObjectType, any> | null)[] = [
        new Column<ObjectType, string>({
            id: 'member.memberNumber',
            name: '#',
            getValue: registration => registration.member.member.details.memberNumber ?? '',
            getStyle: val => val ? '' : 'gray',
            format: val => val ? val : $t(`%1FW`),
            minimumWidth: 100,
            recommendedWidth: 150,
            grow: true,
            allowSorting: true,
            enabled: false,
        }),

        new Column<ObjectType, string>({
            id: 'member.name',
            name: $t(`%Gq`),
            getValue: registration => registration.member.member.name,
            minimumWidth: 100,
            recommendedWidth: 200,
            grow: true,
        }),

        new Column<ObjectType, Date | null>({
            id: 'member.birthDay',
            name: $t(`%17w`),
            getValue: registration => registration.member.member.details.birthDay,
            format: date => date ? Formatter.dateNumber(date, true) : '',
            minimumWidth: 50,
            recommendedWidth: 170,
            enabled: false,
        }),
        new Column<ObjectType, number | null>({
            id: 'member.age',
            name: $t(`%9S`),
            getValue: registration => registration.member.member.details.age,
            format: (age, width) => age ? (width <= 60 ? Formatter.integer(age) : (Formatter.integer(age) + ' ' + $t(`%Hp`))) : $t(`%15v`),
            minimumWidth: 50,
            recommendedWidth: 120,
            enabled: false,
        }),
        // todo
        new Column<ObjectType, { status: MembershipStatus; hasFutureMembership: boolean }>({
            id: 'member.membership',
            name: $t(`%Wq`),
            getValue: (registration) => {
                return {
                    status: registration.member.membershipStatus,
                    hasFutureMembership: registration.member.hasFutureMembership,
                };
            },
            format: ({ status }) => {
                switch (status) {
                    case MembershipStatus.Trial:
                        return $t(`%1IH`);
                    case MembershipStatus.Active:
                        return $t(`%1H0`);
                    case MembershipStatus.Expiring:
                        return $t(`%7F`);
                    case MembershipStatus.Temporary:
                        return $t(`%zU`);
                    case MembershipStatus.Inactive:
                        return $t(`%zV`);
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
            enabled: true,
        }),
        dateRange !== null
            ? new Column<ObjectType, ContinuousMembershipStatus>({
                id: 'member.continuousMembership',
                name: $t('%1IM'),
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
            name: $t(`%7D`),
            allowSorting: false,
            getValue: registration => registration.member.getResponsibilities({ organization: organization ?? undefined }).map(l => l.getName(registration.member, false)),
            format: (list) => {
                if (list.length === 0) {
                    return $t(`%1FW`);
                }
                return list.join(', ');
            },
            getStyle: list => list.length === 0 ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 200,
            enabled: false,
        }),
        new Column<ObjectType, string[]>({
            name: $t(`%1o`),
            allowSorting: false,
            getValue: registration => registration.member.patchedMember.users.filter(u => u.hasAccount).map(u => u.email),
            format: (accounts) => {
                if (accounts.length === 0) {
                    return $t(`%zW`);
                }
                return accounts.join(', ');
            },
            getStyle: accounts => accounts.length === 0 ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 200,
            enabled: false,
        }),
    ];

    // do not show if only 1 price
    if (!group || !(group && group.settings.prices.length < 2)) {
        allColumns.push(new Column<ObjectType, string>({
            id: 'groupPrice',
            allowSorting: true,
            name: $t('%62'),
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
                            return $t(`%1FW`);
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
                                return $t(`%zX`);
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
                name: $t('%8s'),
                getValue: (registration) => {
                    const scope = {
                        checkPermissions: {
                            user: auth.user!,
                            level: PermissionLevel.Read,
                        },
                    };

                    return registration.getMissingData(scope);
                },
                format: prices => Formatter.capitalizeFirstLetter(Formatter.joinLast(prices, ', ', ' ' + $t(`%M1`) + ' ') || $t('%1FW')),
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
                name: group && group.settings.requireOrganizationIds.length !== 1 && group.type === GroupType.EventRegistration ? $t('%cL') : $t('%5E'),
                description: $t('%1Jh'),
                getValue: registration => registration.member.family.getOrganization(registration.group.organizationId),
                format: organization => organization?.name ?? $t('%Gr'),
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
                name: group && group.settings.requireOrganizationIds.length !== 1 && group.type === GroupType.EventRegistration ? $t('%1KP') : $t('%7C'),
                description: $t('%1Ji'),
                getValue: registration => registration.member.family.getOrganization(registration.group.organizationId),
                format: organization => organization?.uri ?? $t('%Gr'),
                getStyle: organization => !organization ? 'gray' : '',
                minimumWidth: 50,
                recommendedWidth: 100,
                enabled: false,
            }),
        );

        allColumns.push(
            new Column<ObjectType, Organization[]>({
                id: 'member.organization',
                allowSorting: false,
                name: $t('%1KQ'),
                description: $t('%1Jj'),
                getValue: registration => registration.member.filterOrganizations({ periodId: filterPeriodId, types: [GroupType.Membership] }),
                format: organizations => Formatter.joinLast(organizations.map(o => o.name).sort(), ', ', ' ' + $t(`%M1`) + ' ') || $t('%5D'),
                getStyle: organizations => organizations.length === 0 ? 'gray' : '',
                minimumWidth: 100,
                recommendedWidth: 300,
                enabled: app === 'admin',
            }),
        );

        allColumns.push(
            new Column<ObjectType, Organization[]>({
                id: 'member.uri',
                allowSorting: false,
                name: $t('%1KR'),
                description: $t('%1Jk'),
                getValue: registration => registration.member.filterOrganizations({ periodId: filterPeriodId, types: [GroupType.Membership] }),
                format: organizations => Formatter.joinLast(organizations.map(o => o.uri).sort(), ', ', ' ' + $t(`%M1`) + ' ') || $t('%1FW'),
                getStyle: organizations => organizations.length === 0 ? 'gray' : '',
                minimumWidth: 100,
                recommendedWidth: 300,
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
                name: $t('%8t'),
                getValue: (registration) => {
                    if (registration.payingOrganizationId) {
                        const organization = registration.member.organizations.find(o => o.id === registration.payingOrganizationId);
                        return organization ? organization.name : $t(`%Gr`);
                    }
                    return null;
                },
                format: organizationName => organizationName || $t(`%18s`),
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
                name: $t(`%1IH`),
                allowSorting: true,
                getValue: (registration) => {
                    if (registration.trialUntil && registration.trialUntil > new Date()) {
                        return new Date(registration.trialUntil.getTime());
                    }
                    return null;
                },
                format: (v, width) => {
                    if (!v) {
                        return $t(`%1FW`);
                    }
                    return $t(`%ze`) + ' ' + (width < 200 ? Formatter.dateNumber(v) : Formatter.date(v));
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
            name: $t(`%7e`),
            allowSorting: true,
            getValue: (registration) => {
                const startDate = registration.startDate;
                if (startDate === null) {
                    return null;
                }

                return new Date(startDate.getTime());
            },
            format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`%Gr`),
            getStyle: v => v === null ? 'gray' : '',
            minimumWidth: 80,
            recommendedWidth: 200,
            enabled: false,
        }),
    );

    allColumns.push(
        new Column<ObjectType, Date | null>({
            id: 'endDate',
            name: $t(`%wB`),
            allowSorting: true,
            getValue: (registration) => {
                const endDate = registration.endDate;
                if (endDate === null) {
                    return null;
                }

                return new Date(endDate.getTime());
            },
            format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`%Gr`),
            getStyle: v => v === null ? 'gray' : '',
            minimumWidth: 80,
            recommendedWidth: 200,
            enabled: false,
        }),
    );

    allColumns.push(
        new Column<ObjectType, Date | null>({
            id: 'registeredAt',
            name: waitingList ? $t(`%zf`) : $t(`%zg`),
            allowSorting: true,
            getValue: registration => registration.registeredAt,
            format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`%Gr`),
            getStyle: v => v === null ? 'gray' : '',
            minimumWidth: 80,
            recommendedWidth: 220,
        }),
    );

    allColumns.push(
        new Column<ObjectType, Date>({
            id: 'member.createdAt',
            name: $t('%1IG'),
            allowSorting: true,
            getValue: registration => registration.member.member.createdAt,
            format: (v, width) => width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true)),
            getStyle: v => v === null ? 'gray' : '',
            minimumWidth: 80,
            recommendedWidth: 220,
        }),
    );

    if (!waitingList && financialRead) {
        allColumns.push(
            new Column<ObjectType, number>({
                id: 'registrationCachedBalance.price',
                name: $t(`%1IP`),
                allowSorting: true,
                getValue: (registration) => {
                    return registration.balances.reduce((sum, r) => sum + (r.amountOpen + r.amountPaid + r.amountPending), 0);
                },
                format: (outstandingBalance) => {
                    if (outstandingBalance < 0) {
                        return Formatter.price(outstandingBalance);
                    }
                    if (outstandingBalance <= 0) {
                        return $t(`%1Mn`);
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
                id: 'registrationCachedBalance.toPay',
                name: $t(`%m0`),
                description: $t('%183'),
                allowSorting: true,
                getValue: (registration) => {
                    return registration.balances.reduce((sum, r) => sum + (r.amountOpen + r.amountPending), 0);
                },
                format: (outstandingBalance) => {
                    if (outstandingBalance < 0) {
                        return Formatter.price(outstandingBalance);
                    }
                    if (outstandingBalance <= 0) {
                        return $t(`%Kw`);
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
                id: 'memberCachedBalance.amountOpen',
                name: $t(`%76`),
                description: $t('%184'),
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
                name: waitingList ? $t(`%1IQ`) : (category.settings.name || $t('%1EI')),
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
                        return $t(`%1FW`);
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
                name: $t('%wI'),
                getValue: (registration) => {
                    return registration.group.defaultAgeGroupId;
                },
                format: (g) => {
                    if (!g) {
                        return $t('%1FW');
                    }
                    return Platform.shared.config.defaultAgeGroups.find(a => a.id === g)?.name.toString() || $t('%Gr');
                },
                getStyle: g => !g ? 'gray' : '',
                minimumWidth: 100,
                recommendedWidth: 300,
                enabled: !group,
            }),
            new Column<ObjectType, Group>({
                id: 'group.name',
                allowSorting: true,
                name: $t('%1IL'),
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
            groups.length === 0 || new Set(groups.map(g => g.type)).size > 1
                ? new Column<ObjectType, GroupType>({
                    id: 'group.type',
                    allowSorting: false,
                    name: $t('%1LP'),
                    getValue: (registration) => {
                        return registration.group.type;
                    },
                    format: (type) => {
                        return getGroupTypeName(type);
                    },
                    minimumWidth: 100,
                    recommendedWidth: 200,
                    enabled: false,
                })
                : null,
        ]);
    }

    return allColumns.filter(column => column !== null);
}
