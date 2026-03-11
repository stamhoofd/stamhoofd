import { Column } from '@stamhoofd/components';
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
            format: val => val ? val : $t(`3ef9e622-426f-4913-89a0-0ce08f4542d4`),
            minimumWidth: 100,
            recommendedWidth: 150,
            grow: true,
            allowSorting: true,
            enabled: false,
        }),

        new Column<ObjectType, string>({
            id: 'member.name',
            name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
            getValue: registration => registration.member.member.name,
            minimumWidth: 100,
            recommendedWidth: 200,
            grow: true,
        }),

        new Column<ObjectType, Date | null>({
            id: 'member.birthDay',
            name: $t(`00650ac3-eb78-4c8b-b7ec-d892772837a1`),
            getValue: registration => registration.member.member.details.birthDay,
            format: date => date ? Formatter.dateNumber(date, true) : '',
            minimumWidth: 50,
            recommendedWidth: 170,
            enabled: false,
        }),
        new Column<ObjectType, number | null>({
            id: 'member.age',
            name: $t(`8c1f264f-3b0b-49b9-8a29-9ceb2dfd7754`),
            getValue: registration => registration.member.member.details.age,
            format: (age, width) => age ? (width <= 60 ? Formatter.integer(age) : (Formatter.integer(age) + ' ' + $t(`608082c7-ce63-43c9-a577-ebaf56c4df82`))) : $t(`0e21480d-5597-4337-bcee-5f4eba73fb7e`),
            minimumWidth: 50,
            recommendedWidth: 120,
            enabled: false,
        }),
        // todo
        new Column<ObjectType, { status: MembershipStatus; hasFutureMembership: boolean }>({
            id: 'member.membership',
            name: $t(`c0277e8e-a2e0-4ec3-9339-c2e1be2e6e2d`),
            getValue: (registration) => {
                return {
                    status: registration.member.membershipStatus,
                    hasFutureMembership: registration.member.hasFutureMembership,
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
            enabled: true,
        }),
        dateRange !== null
            ? new Column<ObjectType, ContinuousMembershipStatus>({
                id: 'member.continuousMembership',
                name: $t('24626f0c-5a0f-4ef6-bb66-f76279b64bfc'),
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
            name: $t(`b0cb950d-856f-4068-bf2f-9636927020f4`),
            allowSorting: false,
            getValue: registration => registration.member.getResponsibilities({ organization: organization ?? undefined }).map(l => l.getName(registration.member, false)),
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
    ];

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
                            return $t(`3ef9e622-426f-4913-89a0-0ce08f4542d4`);
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
                    const scope = {
                        checkPermissions: {
                            user: auth.user!,
                            level: PermissionLevel.Read,
                        },
                    };

                    return registration.getMissingData(scope);
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
            new Column<ObjectType, Organization | undefined>({
                id: 'organization.name',
                allowSorting: true,
                name: group && group.settings.requireOrganizationIds.length !== 1 && group.type === GroupType.EventRegistration ? $t('55e86a73-d637-4ca0-82ac-abd27d60705f') : $t('2f325358-6e2f-418c-9fea-31a14abbc17a'),
                description: $t('517e056d-b0f7-4103-b717-5550c0c38cff'),
                getValue: registration => registration.member.family.getOrganization(registration.group.organizationId),
                format: organization => organization?.name ?? $t('49e90fda-d262-4fe7-a2e2-d6b48abc8e2b'),
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
                name: group && group.settings.requireOrganizationIds.length !== 1 && group.type === GroupType.EventRegistration ? $t('33baaf22-e844-4de1-960e-fc2dec76b5f1') : $t('05723781-9357-41b2-9fb8-cb4f80dde7f9'),
                description: $t('983d267c-b44b-40bd-b0b6-565032ab01a9'),
                getValue: registration => registration.member.family.getOrganization(registration.group.organizationId),
                format: organization => organization?.uri ?? $t('49e90fda-d262-4fe7-a2e2-d6b48abc8e2b'),
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
                name: $t('5a1993a8-2604-4ca5-be6e-8d6902d9f8c1'),
                description: $t('78b5bb21-5de1-4f0d-ad18-321edc4ba275'),
                getValue: registration => registration.member.filterOrganizations({ periodId: filterPeriodId, types: [GroupType.Membership] }),
                format: organizations => Formatter.joinLast(organizations.map(o => o.name).sort(), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ') || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f'),
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
                name: $t('068b0bcf-f269-4425-8a48-89ad156d6fad'),
                description: $t('e8dd32de-9708-4e77-ad38-fdd28b53d5b9'),
                getValue: registration => registration.member.filterOrganizations({ periodId: filterPeriodId, types: [GroupType.Membership] }),
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
                getValue: (registration) => {
                    if (registration.payingOrganizationId) {
                        const organization = registration.member.organizations.find(o => o.id === registration.payingOrganizationId);
                        return organization ? organization.name : $t(`49e90fda-d262-4fe7-a2e2-d6b48abc8e2b`);
                    }
                    return null;
                },
                format: organizationName => organizationName || $t(`08dd4181-69c6-4888-b32a-07224f1c4349`),
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
                name: $t(`1f2e9d09-717b-4c17-9bbe-dce3f3dcbff0`),
                allowSorting: true,
                getValue: (registration) => {
                    if (registration.trialUntil && registration.trialUntil > new Date()) {
                        return new Date(registration.trialUntil.getTime());
                    }
                    return null;
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
            id: 'startDate',
            name: $t(`300d2935-b578-48cc-b58e-1c0446a68d59`),
            allowSorting: true,
            getValue: (registration) => {
                const startDate = registration.startDate;
                if (startDate === null) {
                    return null;
                }

                return new Date(startDate.getTime());
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
            id: 'endDate',
            name: $t(`3c90169c-9776-4d40-bda0-dba27a5bad69`),
            allowSorting: true,
            getValue: (registration) => {
                const endDate = registration.endDate;
                if (endDate === null) {
                    return null;
                }

                return new Date(endDate.getTime());
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
            id: 'registeredAt',
            name: waitingList ? $t(`2a96fc1f-3710-4eae-bd01-b95ef8c2622b`) : $t(`8895f354-658f-48bd-9d5d-2e0203ca2a36`),
            allowSorting: true,
            getValue: registration => registration.registeredAt,
            format: (v, width) => v ? (width < 200 ? (width < 140 ? Formatter.dateNumber(v, false) : Formatter.dateNumber(v, true)) : (width > 240 ? Formatter.dateTime(v) : Formatter.date(v, true))) : $t(`49e90fda-d262-4fe7-a2e2-d6b48abc8e2b`),
            getStyle: v => v === null ? 'gray' : '',
            minimumWidth: 80,
            recommendedWidth: 220,
        }),
    );

    allColumns.push(
        new Column<ObjectType, Date>({
            id: 'member.createdAt',
            name: $t('63a86cdf-8a76-4e8c-9073-4f0b8970e808'),
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
                name: $t(`1205deb9-498d-435d-a6e1-91ea98371523`),
                allowSorting: true,
                getValue: (registration) => {
                    return registration.balances.reduce((sum, r) => sum + (r.amountOpen + r.amountPaid + r.amountPending), 0);
                },
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
                id: 'registrationCachedBalance.toPay',
                name: $t(`18aed6d0-0880-4d06-9260-fe342e6e8064`),
                description: $t('7a8d174e-2807-4ada-ad94-6f519edc9c14'),
                allowSorting: true,
                getValue: (registration) => {
                    return registration.balances.reduce((sum, r) => sum + (r.amountOpen + r.amountPending), 0);
                },
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

    if (organization !== null) {
        allColumns.push(
            new Column<ObjectType, number>({
                id: 'memberCachedBalance.amountOpen',
                name: $t(`28c2bc66-231f-44f3-9249-c1981b871a1f`),
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
                name: waitingList ? $t(`565a7968-e547-411e-aaff-6f936c128d5f`) : (category.settings.name || $t('3f4c9896-7f02-4b49-ad29-2d363a8af71f')),
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

    if (!group) {
        allColumns.push(...[
            new Column<ObjectType, string | null>({
                id: 'group.defaultAgeGroup',
                // todo?
                allowSorting: false,
                name: $t('0ef2bbb3-0b3c-411a-8901-a454cff1f839'),
                getValue: (registration) => {
                    return registration.group.defaultAgeGroupId;
                },
                format: (g) => {
                    if (!g) {
                        return $t('3ef9e622-426f-4913-89a0-0ce08f4542d4');
                    }
                    return Platform.shared.config.defaultAgeGroups.find(a => a.id === g)?.name.toString() || $t('49e90fda-d262-4fe7-a2e2-d6b48abc8e2b');
                },
                getStyle: g => !g ? 'gray' : '',
                minimumWidth: 100,
                recommendedWidth: 300,
                enabled: !group,
            }),
            new Column<ObjectType, Group>({
                id: 'group.name',
                allowSorting: true,
                name: $t('877284d7-31b4-4857-a963-405b4139adc2'),
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
                    name: $t('23671282-34da-4da9-8afd-503811621055'),
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
