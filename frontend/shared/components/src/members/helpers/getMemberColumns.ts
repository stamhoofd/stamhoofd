import { Column } from '#tables/classes/Column.ts';
import type { ContextPermissions } from '@stamhoofd/networking/ContextPermissions';
import type { AppType, Group, GroupCategoryTree, Organization, PlatformMember } from '@stamhoofd/structures';
import { ContinuousMembershipStatus, GroupType, MembershipStatus, PermissionLevel } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';

type ObjectType = PlatformMember;

export function getMemberColumns({ organization, dateRange, groups, filterPeriodId, periodId, auth, category, app, financialRead }: { organization: Organization | null; dateRange?: { start: Date; end: Date } | null; groups: Group[]; filterPeriodId: string; periodId?: string | null; auth: ContextPermissions; category?: GroupCategoryTree | null; app: AppType | 'auto'; financialRead: boolean }) {
    const isPlatform = STAMHOOFD.userMode === 'platform';

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
            name: $t(`%1Os`),
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
        isPlatform
            ? new Column<ObjectType, { status: MembershipStatus; hasFutureMembership: boolean }>({
                    id: 'membership',
                    name: $t(`%1Ny`),
                    enabled: true,
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
                })
            : null,
        isPlatform && dateRange !== null
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
                    } else {
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

    if (app === 'admin') {
        allColumns.push(
            new Column<ObjectType, Organization[]>({
                id: 'organization',
                allowSorting: false,
                name: $t('%1PI'),
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
                name: $t('%1O1'),
                getValue: member => member.filterOrganizations({ periodId: filterPeriodId, types: [GroupType.Membership] }),
                format: organizations => Formatter.joinLast(organizations.map(o => o.uri).sort(), ', ', ' ' + $t(`%M1`) + ' ') || $t('%1FW'),
                getStyle: organizations => organizations.length === 0 ? 'gray' : '',
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
                    const registrations = v.filterRegistrations({ groups, periodId: periodId ?? '' });

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
            id: 'registeredAt',
            name: $t(`%zg`),
            allowSorting: true,
            getValue: (v) => {
                const registrations = v.filterRegistrations({ });

                if (registrations.length === 0) {
                    return null;
                }

                const filtered = registrations.filter(r => r.registeredAt !== null).map(r => r.registeredAt!.getTime());

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

    if (financialRead) {
        allColumns.push(
            new Column<ObjectType, number>({
                id: 'memberCachedBalance.toPay',
                name: $t(`Rekening`),
                description: $t('Openstaande rekening voor dit lid'),
                allowSorting: true,
                getValue: v => v.member.balances.reduce((sum, r) => sum + (r.amountOpen + r.amountPending), 0),
                format: (outstandingBalance) => {
                    if (outstandingBalance < 0) {
                        return Formatter.price(outstandingBalance);
                    }
                    if (outstandingBalance <= 0) {
                        return $t(`%1OD`);
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

    if (category) {
        allColumns.push(
            new Column<ObjectType, Group[]>({
                id: 'category',
                allowSorting: false,
                name: (category.settings.name || $t('%1EI')),
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
    } else {
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
