import { Column } from '@stamhoofd/components';
import { ContextPermissions } from '@stamhoofd/networking';
import { AppType, ContinuousMembershipStatus, Group, GroupCategoryTree, GroupPrice, GroupType, MembershipStatus, Organization, PermissionLevel, PlatformMember, RecordAnswer, RegisterItemOption } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';

type ObjectType = PlatformMember;

export function getMemberColumns({ organization, dateRange, group, groups, filterPeriodId, periodId, auth, category, app, waitingList, financialRead }: { organization: Organization | null; dateRange?: { start: Date; end: Date } | null; group?: Group | null; groups: Group[]; filterPeriodId: string; periodId?: string | null; auth: ContextPermissions; category?: GroupCategoryTree | null; app: AppType | 'auto'; waitingList: boolean | null; financialRead: boolean }) {
    const allColumns: Column<ObjectType, any>[] = [
        new Column<ObjectType, string>({
            id: 'memberNumber',
            name: '#',
            getValue: member => member.member.details.memberNumber ?? '',
            getStyle: val => val ? '' : 'gray',
            format: val => val ? val : $t(`3ef9e622-426f-4913-89a0-0ce08f4542d4`),
            minimumWidth: 100,
            recommendedWidth: 150,
            grow: true,
            allowSorting: true,
            enabled: false,
        }),

        new Column<ObjectType, string>({
            id: 'name',
            name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
            getValue: member => member.member.name,
            minimumWidth: 100,
            recommendedWidth: 200,
            grow: true,
        }),
        new Column<ObjectType, Date | null>({
            id: 'birthDay',
            name: $t(`00650ac3-eb78-4c8b-b7ec-d892772837a1`),
            getValue: member => member.member.details.birthDay,
            format: date => date ? Formatter.dateNumber(date, true) : '',
            minimumWidth: 50,
            recommendedWidth: 170,
            enabled: false,
        }),
        new Column<ObjectType, number | null>({
            id: 'age',
            name: $t(`8c1f264f-3b0b-49b9-8a29-9ceb2dfd7754`),
            getValue: member => member.member.details.age,
            format: (age, width) => age !== null ? (width <= 60 ? Formatter.integer(age) : (Formatter.integer(age) + ' ' + $t(`608082c7-ce63-43c9-a577-ebaf56c4df82`))) : $t(`0e21480d-5597-4337-bcee-5f4eba73fb7e`),
            minimumWidth: 50,
            recommendedWidth: 120,
        }),
        new Column<ObjectType, { status: MembershipStatus; hasFutureMembership: boolean }>({
            id: 'membership',
            name: $t(`c0277e8e-a2e0-4ec3-9339-c2e1be2e6e2d`),
            getValue: (member) => {
                return {
                    status: member.membershipStatus,
                    hasFutureMembership: member.hasFutureMembership,
                };
            },
            format: ({ status }) => {
                switch (status) {
                    case MembershipStatus.Trial:
                        return $t(`1f2e9d09-717b-4c17-9bbe-dce3f3dcbff0`);
                    case MembershipStatus.Active:
                        return $t(`079afc7a-6ccb-4c7f-b739-24198b0cfec2`);
                    case MembershipStatus.Expiring:
                        return $t(`cc528c3f-aed3-4eb6-9db1-70aae5261a28`);
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
            name: $t(`b0cb950d-856f-4068-bf2f-9636927020f4`),
            allowSorting: false,
            getValue: member => member.getResponsibilities({ organization: organization ?? undefined }).map(l => l.getName(member, false)),
            format: (list) => {
                if (list.length === 0) {
                    return $t(`3ef9e622-426f-4913-89a0-0ce08f4542d4`);
                }
                return list.join(', ');
            },
            getStyle: list => list.length === 0 ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 200,
            enabled: false,
        }),
        new Column<ObjectType, string[]>({
            name: $t(`ac747fb2-d391-499b-8cee-1ed7241e6177`),
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

    if (group) {
        if (group.settings.prices.length > 1) {
            allColumns.push(
                new Column<ObjectType, GroupPrice[]>({
                    id: 'groupPrice',
                    allowSorting: false,
                    name: $t('a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc'),
                    getValue: member => member.filterRegistrations({ groups: [group!] }).map(r => r.groupPrice),
                    format: prices => Formatter.joinLast(prices.map(o => o.name.toString()).sort(), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ') || $t('3ef9e622-426f-4913-89a0-0ce08f4542d4'),
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
                            return $t(`3ef9e622-426f-4913-89a0-0ce08f4542d4`);
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
        /**
         * Note: this column has a large performance impact, and causes lag, because it needs to do permission checking and checking whether properties are enabled/required.
         * It needs some caching.
         */
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
                        scopeOrganization: organization,
                    };

                    // Check missing information
                    if (!member.patchedMember.details.phone && member.isPropertyRequired('phone', scope)) {
                        base.push($t(`de723a38-6e76-418a-a6f6-52c6ed45c5c8`));
                    }

                    if (!member.patchedMember.details.email && member.isPropertyRequired('emailAddress', scope)) {
                        base.push($t(`64163c88-2610-4542-9fd4-db523670049c`));
                    }

                    if (!member.patchedMember.details.address && member.isPropertyRequired('address', scope)) {
                        base.push($t(`38f3e042-b8a7-4bba-bf2a-d7c391f23268`));
                    }

                    if (!member.patchedMember.details.birthDay && member.isPropertyRequired('birthDay', scope)) {
                        base.push($t(`88a24a2b-d84a-4c7e-978d-6180e260a06f`));
                    }

                    if (!member.patchedMember.details.nationalRegisterNumber && member.isPropertyRequired('nationalRegisterNumber', scope)) {
                        base.push($t(`cd5d00db-1fcc-4079-bbe3-36dc001e93d4`));
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

                    const { categories: enabledCategories } = member.getEnabledRecordCategories(scope);

                    const incomplete = enabledCategories.filter(c => !c.isComplete(member));
                    return [...base, ...incomplete.map(c => c.name.toString())];
                },
                format: prices => Formatter.capitalizeFirstLetter(Formatter.joinLast(prices, ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ') || $t('3ef9e622-426f-4913-89a0-0ce08f4542d4')),
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
                name: $t('2f325358-6e2f-418c-9fea-31a14abbc17a'),
                getValue: member => member.filterOrganizations({ periodId: filterPeriodId, types: [GroupType.Membership] }),
                format: organizations => Formatter.joinLast(organizations.map(o => o.name).sort(), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ') || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f'),
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
                name: $t('05723781-9357-41b2-9fb8-cb4f80dde7f9'),
                getValue: member => member.filterOrganizations({ periodId: filterPeriodId, types: [GroupType.Membership] }),
                format: organizations => Formatter.joinLast(organizations.map(o => o.uri).sort(), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ') || $t('3ef9e622-426f-4913-89a0-0ce08f4542d4'),
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
                name: $t('7289b10e-a284-40ea-bc57-8287c6566a82'),
                getValue: (member) => {
                    const registrations = member.filterRegistrations({ groups, periodId: filterPeriodId });
                    if (registrations.find(r => r.payingOrganizationId)) {
                        const organization = member.organizations.find(o => o.id === registrations[0].payingOrganizationId);
                        return organization ? organization.name : $t(`49e90fda-d262-4fe7-a2e2-d6b48abc8e2b`);
                    }
                    return null;
                },
                format: organizations => organizations || $t(`08dd4181-69c6-4888-b32a-07224f1c4349`),
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
                name: $t(`1f2e9d09-717b-4c17-9bbe-dce3f3dcbff0`),
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
                        return $t(`3ef9e622-426f-4913-89a0-0ce08f4542d4`);
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
            name: $t(`300d2935-b578-48cc-b58e-1c0446a68d59`),
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
            format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`49e90fda-d262-4fe7-a2e2-d6b48abc8e2b`),
            getStyle: v => v === null ? 'gray' : '',
            minimumWidth: 80,
            recommendedWidth: 200,
            enabled: false,
        }),
    );

    allColumns.push(
        new Column<ObjectType, Date | null>({
            name: $t(`3c90169c-9776-4d40-bda0-dba27a5bad69`),
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
            format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`49e90fda-d262-4fe7-a2e2-d6b48abc8e2b`),
            getStyle: v => v === null ? 'gray' : '',
            minimumWidth: 80,
            recommendedWidth: 200,
            enabled: false,
        }),
    );

    allColumns.push(
        new Column<ObjectType, Date | null>({
            name: waitingList ? $t(`2a96fc1f-3710-4eae-bd01-b95ef8c2622b`) : $t(`8895f354-658f-48bd-9d5d-2e0203ca2a36`),
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
            format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`49e90fda-d262-4fe7-a2e2-d6b48abc8e2b`),
            getStyle: v => v === null ? 'gray' : '',
            minimumWidth: 80,
            recommendedWidth: 220,
        }),
    );

    allColumns.push(
        new Column<ObjectType, Date>({
            id: 'createdAt',
            name: $t('6711ac76-e8c7-482b-b6b4-635ba3d16f60'),
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
                name: $t(`1205deb9-498d-435d-a6e1-91ea98371523`),
                allowSorting: false,
                getValue: v => v.filterRegistrations({ groups: groups }).flatMap(r => r.balances).reduce((sum, r) => sum + (r.amountOpen + r.amountPaid + r.amountPending), 0),
                format: (outstandingBalance) => {
                    if (outstandingBalance < 0) {
                        return Formatter.price(outstandingBalance);
                    }
                    if (outstandingBalance <= 0) {
                        return $t(`02f28dc5-b75f-4bfb-9e07-90dfb56b66b4`);
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
                name: $t(`18aed6d0-0880-4d06-9260-fe342e6e8064`),
                description: $t('7a8d174e-2807-4ada-ad94-6f519edc9c14'),
                allowSorting: false,
                getValue: v => v.filterRegistrations({ groups: groups }).flatMap(r => r.balances).reduce((sum, r) => sum + (r.amountOpen + r.amountPending), 0),
                format: (outstandingBalance) => {
                    if (outstandingBalance < 0) {
                        return Formatter.price(outstandingBalance);
                    }
                    if (outstandingBalance <= 0) {
                        return $t(`1c1933f1-fee4-4e7d-9c89-57593fd5bed3`);
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
            name: $t(`28c2bc66-231f-44f3-9249-c1981b871a1f`),
            description: $t('6c5de33a-dbbd-4b9c-866d-104e007836b3'),
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
                name: waitingList ? $t(`565a7968-e547-411e-aaff-6f936c128d5f`) : (category.settings.name || $t('3f4c9896-7f02-4b49-ad29-2d363a8af71f')),
                getValue: (member) => {
                    if (!category) {
                        return [];
                    }
                    const groups = category.getAllGroups();
                    const memberGroups = member.filterGroups({ groups: groups, periodId: filterPeriodId });
                    const getIndex = g => groups.findIndex(_g => _g.id === g.id);
                    return memberGroups.sort((a, b) => Sorter.byNumberValue(getIndex(b), getIndex(a)));
                },
                format: (groups) => {
                    if (groups.length === 0) {
                        return $t(`3ef9e622-426f-4913-89a0-0ce08f4542d4`);
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
                name: $t('3f4c9896-7f02-4b49-ad29-2d363a8af71f'),
                getValue: (member) => {
                    let memberGroups = member.filterGroups({ periodId: filterPeriodId, types: [GroupType.Membership, GroupType.WaitingList] });
                    if (app === 'admin') {
                        memberGroups = memberGroups.filter(g => g.defaultAgeGroupId !== null);
                    }
                    return memberGroups.sort((a, b) => Sorter.byStringValue(a.settings.name.toString(), b.settings.name.toString()));
                },
                format: (groups) => {
                    if (groups.length === 0) {
                        return $t(`3ef9e622-426f-4913-89a0-0ce08f4542d4`);
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
