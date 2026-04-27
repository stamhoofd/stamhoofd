import { Column } from '#tables/classes/Column.ts';
import type { ContextPermissions } from '@stamhoofd/networking/ContextPermissions';
import type { AppType, Group, GroupCategoryTree, GroupPrice, Organization, PlatformMember, RecordAnswer, RegisterItemOption } from '@stamhoofd/structures';
import { ContinuousMembershipStatus, GroupType, MembershipStatus, PermissionLevel } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';

type ObjectType = PlatformMember;

export function getMemberColumns({ organization, dateRange, group, groups, filterPeriodId, periodId, auth, category, app, waitingList, financialRead }: { organization: Organization | null; dateRange?: { start: Date; end: Date } | null; group?: Group | null; groups: Group[]; filterPeriodId: string; periodId?: string | null; auth: ContextPermissions; category?: GroupCategoryTree | null; app: AppType | 'auto'; waitingList: boolean | null; financialRead: boolean }) {
    const allColumns: Column<ObjectType, any>[] = [
        new Column<ObjectType, string>({
            id: 'memberNumber',
            name: '#',
            getValue: member => member.member.details.memberNumber ?? '',
            getStyle: val => val ? '' : 'gray',
            format: val => val ? val : $t(`%1FW`),
            minimumWidth: 100,
            recommendedWidth: 150,
            grow: true,
            allowSorting: true,
            enabled: false,
        }),

        new Column<ObjectType, string>({
            id: 'name',
            name: $t(`%Gq`),
            getValue: member => member.member.name,
            minimumWidth: 100,
            recommendedWidth: 200,
            grow: true,
        }),
        new Column<ObjectType, Date | null>({
            id: 'birthDay',
            name: $t(`%17w`),
            getValue: member => member.member.details.birthDay,
            format: date => date ? Formatter.dateNumber(date, true) : '',
            minimumWidth: 50,
            recommendedWidth: 170,
            enabled: false,
        }),
        new Column<ObjectType, number | null>({
            id: 'age',
            name: $t(`%9S`),
            getValue: member => member.member.details.age,
            format: (age, width) => age !== null ? (width <= 60 ? Formatter.integer(age) : (Formatter.integer(age) + ' ' + $t(`%Hp`))) : $t(`%15v`),
            minimumWidth: 50,
            recommendedWidth: 120,
        }),
        new Column<ObjectType, { status: MembershipStatus; hasFutureMembership: boolean }>({
            id: 'membership',
            name: $t(`%Wq`),
            enabled: !waitingList,
            getValue: (member) => {
                return {
                    status: member.membershipStatus,
                    hasFutureMembership: member.hasFutureMembership,
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
        }),
        dateRange !== null
            ? new Column<ObjectType, ContinuousMembershipStatus>({
                id: 'continuousMembership',
                name: 'Doorlopende aansluiting',
                getValue: member => member.getContinuousMembershipStatus(dateRange!),
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
            getValue: member => member.getResponsibilities({ organization: organization ?? undefined }).map(l => l.getName(member, false)),
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
            getValue: member => member.patchedMember.users.filter(u => u.hasAccount).map(u => u.email),
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
    ].filter(column => column !== null);

    if (group) {
        if (group.settings.prices.length > 1) {
            allColumns.push(
                new Column<ObjectType, GroupPrice[]>({
                    id: 'groupPrice',
                    allowSorting: false,
                    name: $t('%62'),
                    getValue: member => member.filterRegistrations({ groups: [group!] }).map(r => r.groupPrice),
                    format: prices => Formatter.joinLast(prices.map(o => o.name.toString()).sort(), ', ', ' ' + $t(`%M1`) + ' ') || $t('%1FW'),
                    getStyle: prices => prices.length === 0 ? 'gray' : '',
                    minimumWidth: 100,
                    recommendedWidth: 300,
                }),
            );
        }

        for (const optionMenu of group.settings.optionMenus) {
            allColumns.push(
                new Column<ObjectType, RegisterItemOption[]>({
                    id: 'optionMenu-' + optionMenu.id,
                    allowSorting: false,
                    name: optionMenu.name,
                    getValue: member => member.filterRegistrations({ groups: [group!] }).flatMap((r) => {
                        const option = r.options.find(o => o.optionMenu.id === optionMenu.id);
                        if (!option) {
                            return [];
                        }
                        return [option];
                    }),
                    format: (values) => {
                        if (values.length === 0) {
                            return $t(`%1FW`);
                        }
                        return values.map(v => v.option.allowAmount || v.amount > 1 ? (v.amount + 'x ' + v.option.name) : v.option.name).join(', ');
                    },
                    getStyle: values => values.length === 0 ? 'gray' : '',
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
                        getValue: (member) => {
                            for (const registration of member.filterRegistrations({ groups: [group!] })) {
                                const answer = registration.recordAnswers.get(record.id);
                                if (answer) {
                                    return answer;
                                }
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
        /**
         * Note: this column has a large performance impact, and causes lag, because it needs to do permission checking and checking whether properties are enabled/required.
         * It needs some caching.
         */
        allColumns.push(
            new Column<ObjectType, string[]>({
                id: 'missing-record-categories',
                allowSorting: false,
                name: $t('%8s'),
                getValue: (member) => {
                    const base: string[] = [];
                    const scope = {
                        scopeGroups: groups,
                        checkPermissions: {
                            user: auth.user!,
                            level: PermissionLevel.Read,
                        },
                        scopeOrganization: organization,
                    };

                    // Check missing information
                    if (!member.patchedMember.details.phone && member.isPropertyRequired('phone', scope)) {
                        base.push($t(`%zY`));
                    }

                    if (!member.patchedMember.details.email && member.isPropertyRequired('emailAddress', scope)) {
                        base.push($t(`%zZ`));
                    }

                    if (!member.patchedMember.details.address && member.isPropertyRequired('address', scope)) {
                        base.push($t(`%19P`));
                    }

                    if (!member.patchedMember.details.birthDay && member.isPropertyRequired('birthDay', scope)) {
                        base.push($t(`%za`));
                    }

                    if (!member.patchedMember.details.nationalRegisterNumber && member.isPropertyRequired('nationalRegisterNumber', scope)) {
                        base.push($t(`%19Q`));
                    }
                    else {
                        if (member.isPropertyRequired('parents', scope) && member.isPropertyRequired('nationalRegisterNumber', scope) && !member.patchedMember.details.parents.find(p => p.nationalRegisterNumber)) {
                            base.push($t(`%zb`));
                        }
                    }

                    if (member.isPropertyRequired('parents', scope)) {
                        if (member.patchedMember.details.parents.length === 0) {
                            base.push($t(`%zc`));
                        }
                    }

                    if (member.patchedMember.details.emergencyContacts.length === 0 && member.isPropertyRequired('emergencyContacts', scope)) {
                        base.push($t(`%zd`));
                    }

                    const { categories: enabledCategories } = member.getEnabledRecordCategories(scope);

                    const incomplete = enabledCategories.filter(c => !c.isComplete(member));
                    return [...base, ...incomplete.map(c => c.name.toString())];
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
            new Column<ObjectType, Organization[]>({
                id: 'organization',
                allowSorting: false,
                name: $t('%5E'),
                getValue: member => member.filterOrganizations({ periodId: filterPeriodId, types: [GroupType.Membership] }),
                format: organizations => Formatter.joinLast(organizations.map(o => o.name).sort(), ', ', ' ' + $t(`%M1`) + ' ') || $t('%5D'),
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
                name: $t('%7C'),
                getValue: member => member.filterOrganizations({ periodId: filterPeriodId, types: [GroupType.Membership] }),
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
                getValue: (member) => {
                    const registrations = member.filterRegistrations({ groups, periodId: filterPeriodId });
                    if (registrations.find(r => r.payingOrganizationId)) {
                        const organization = member.organizations.find(o => o.id === registrations[0].payingOrganizationId);
                        return organization ? organization.name : $t(`%Gr`);
                    }
                    return null;
                },
                format: organizations => organizations || $t(`%18s`),
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
                name: $t(`%1IH`),
                allowSorting: false,
                getValue: (v) => {
                    const registrations = v.filterRegistrations({ groups, periodId: periodId ?? group?.periodId ?? '' });

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
            name: $t(`%7e`),
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
            format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`%Gr`),
            getStyle: v => v === null ? 'gray' : '',
            minimumWidth: 80,
            recommendedWidth: 200,
            enabled: false,
        }),
    );

    allColumns.push(
        new Column<ObjectType, Date | null>({
            name: $t(`%wB`),
            allowSorting: false,
            getValue: (v) => {
                const registrations = v.filterRegistrations({ groups, periodId: filterPeriodId });

                if (registrations.length === 0) {
                    return null;
                }

                const filtered = registrations.filter(r => r.endDate).map(r => r.endDate!.getTime());

                if (filtered.length === 0) {
                    return null;
                }
                return new Date(Math.max(...filtered));
            },
            format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`%Gr`),
            getStyle: v => v === null ? 'gray' : '',
            minimumWidth: 80,
            recommendedWidth: 200,
            enabled: false,
        }),
    );

    if (waitingList && group) {
        const waitingListId = group.id;

        allColumns.push(
            new Column<ObjectType, string[]>({
                name: $t('Toegelaten voor'),
                enabled: true,
                // todo?
                allowSorting: false,
                getValue: (v) => {
                    if (organization) {
                        return v.member.registrationInvitations.filter(r => r.organizationId === organization.id).map(i => i.groupName.toString());
                    }
                    return v.member.registrationInvitations.filter(i => i.waitingListId === waitingListId).map(i => i.groupName.toString());
                },
                format: (v) => {
                    if (v.length === 0) {
                        return $t('Nog niet toegelaten');
                    }
                    return Formatter.joinLast(v.sort(), ', ', ' ' + $t(`%M1`) + ' ');
                },
                getStyle: v => v.length === 0 ? 'gray' : '',
                minimumWidth: 100,
                recommendedWidth: 200
            })
        )
    }

    allColumns.push(
        new Column<ObjectType, Date | null>({
            name: waitingList ? $t(`%zf`) : $t(`%zg`),
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
            format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`%Gr`),
            getStyle: v => v === null ? 'gray' : '',
            minimumWidth: 80,
            recommendedWidth: 220,
        }),
    );

    allColumns.push(
        new Column<ObjectType, Date>({
            id: 'createdAt',
            name: $t('%1Jc'),
            allowSorting: true,
            getValue: (v) => {
                return v.member.createdAt;
            },
            format: (v, width) => width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true)),
            getStyle: v => v === null ? 'gray' : '',
            minimumWidth: 80,
            recommendedWidth: 220,
        }),
    );

    if (!waitingList && financialRead && groups.length > 0) {
        allColumns.push(
            new Column<ObjectType, number>({
                name: $t(`%1IP`),
                allowSorting: false,
                getValue: v => v.filterRegistrations({ groups: groups }).flatMap(r => r.balances).reduce((sum, r) => sum + (r.amountOpen + r.amountPaid + r.amountPending), 0),
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
                name: $t(`%m0`),
                description: $t('%183'),
                allowSorting: false,
                getValue: v => v.filterRegistrations({ groups: groups }).flatMap(r => r.balances).reduce((sum, r) => sum + (r.amountOpen + r.amountPending), 0),
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

    allColumns.push(
        new Column<ObjectType, number>({
            name: $t(`%76`),
            description: $t('%184'),
            allowSorting: false,
            getValue: v => v.member.balances.reduce((sum, r) => sum + (r.amountOpen), 0),
            format: (outstandingBalance) => {
                return Formatter.price(outstandingBalance);
            },
            getStyle: v => v === 0 ? 'gray' : (v < 0 ? 'negative' : ''),
            minimumWidth: 70,
            recommendedWidth: 200,
            enabled: false,
        }),
    );

    if (category) {
        allColumns.push(
            new Column<ObjectType, Group[]>({
                id: 'category',
                allowSorting: false,
                name: waitingList ? $t(`%1IQ`) : (category.settings.name || $t('%1EI')),
                getValue: (member) => {
                    if (!category) {
                        return [];
                    }
                    const groups = category.getAllGroups();
                    const memberGroups = member.filterGroups({ groups: groups, periodId: filterPeriodId });
                    const getIndex = (g: Group) => groups.findIndex(_g => _g.id === g.id);
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

    if (!group && !category) {
        allColumns.push(
            new Column<ObjectType, Group[]>({
                id: 'category',
                allowSorting: false,
                name: $t('%1EI'),
                getValue: (member) => {
                    let memberGroups = member.filterGroups({ periodId: filterPeriodId, types: [GroupType.Membership, GroupType.WaitingList] });
                    if (app === 'admin') {
                        memberGroups = memberGroups.filter(g => g.defaultAgeGroupId !== null);
                    }
                    return memberGroups.sort((a, b) => Sorter.byStringValue(a.settings.name.toString(), b.settings.name.toString()));
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

    return allColumns;
}
