import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import type { ContextPermissions } from '@stamhoofd/networking/ContextPermissions';
import type { Group, Organization, Platform} from '@stamhoofd/structures';
import { AccessRight, FinancialSupportSettings, GroupType, RecordCategory } from '@stamhoofd/structures';

export function getSelectableWorkbook(platform: Platform, organization: Organization | null, groups: Group[] = [], auth: ContextPermissions) {
    const groupColumns: SelectableColumn[] = [];

    for (const group of groups) {
        for (const menu of group.settings.optionMenus) {
            groupColumns.push(
                new SelectableColumn({
                    id: `optionMenu.${menu.id}`,
                    name: menu.name,
                    category: group.settings.name.toString(),
                }),
            );

            for (const option of menu.options) {
                if (option.allowAmount) {
                    groupColumns.push(
                        new SelectableColumn({
                            id: `optionMenu.${menu.id}.${option.id}.amount`,
                            name: menu.name + ' → ' + option.name + ' → ' + $t('%M4'),
                            category: group.settings.name.toString(),
                        }),
                    );
                }
            }
        }

        for (const recordCategory of group.settings.recordCategories) {
            const records = recordCategory.getAllRecords();

            for (const record of records) {
                groupColumns.push(
                    new SelectableColumn({
                        id: `recordAnswers.${record.id}`,
                        name: recordCategory.name + ' → ' + record.name,
                        category: group.settings.name.toString(),
                    }),
                );
            }
        }
    }

    const recordCategories = [
        ...(organization?.meta.recordsConfiguration.recordCategories ?? []),
        ...platform.config.recordsConfiguration.recordCategories,
    ];

    const financialSupportSettings = platform.config.financialSupport ?? FinancialSupportSettings.create({});
    const financialSupportTitle = financialSupportSettings.title;

    const flattenedCategories = RecordCategory.flattenCategoriesWith(recordCategories, r => r.excelColumns.length > 0);

    const returnNullIfNoAccessRight = <T extends SelectableColumn>(column: T, requiresAccessRights: AccessRight[]): T | null => {
        if (requiresAccessRights.some(accessRight => !auth.hasAccessRight(accessRight))) {
            return null;
        }

        return column;
    };

    const hasEvent = !!groups.length && !!groups.find(group => group.settings.requireOrganizationIds.length !== 1 && group.type === GroupType.EventRegistration);

    const columns: (SelectableColumn | null) [] = [
        // member
        new SelectableColumn({
            id: 'member.id',
            name: $t('%1GH'),
            description: $t(`%ev`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.memberNumber',
            name: $t(`%19j`),
        }),
        new SelectableColumn({
            id: 'member.firstName',
            name: $t(`%1MT`),
        }),
        new SelectableColumn({
            id: 'member.lastName',
            name: $t(`%1MU`),
        }),
        new SelectableColumn({
            id: 'member.birthDay',
            name: $t(`%17w`),
        }),
        new SelectableColumn({
            id: 'member.age',
            name: $t(`%9S`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.gender',
            name: $t(`%19i`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.phone',
            name: $t(`%wD`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.email',
            name: $t(`%1FK`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.address',
            name: $t(`%Cn`),
            description: $t(`%ew`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.securityCode',
            name: $t(`%wE`),
            enabled: false,
            description: $t(`%ex`),
        }),
        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'member.requiresFinancialSupport',
            name: financialSupportTitle,
            enabled: false,
        }), [AccessRight.MemberReadFinancialData]),
        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'member.uitpasNumber',
            name: $t(`%wF`),
            enabled: false,
        }), [AccessRight.MemberReadFinancialData]),
        new SelectableColumn({
            id: 'member.notes',
            name: $t(`%Ve`),
            enabled: false,
        }),
        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'member.nationalRegisterNumber',
            name: $t(`%wK`),
            enabled: false,
        }), [AccessRight.MemberManageNRN]),
        new SelectableColumn({
            id: 'member.membership',
            name: $t(`%Wq`),
            enabled: false,
        }),
        groups.some(group => group.type === GroupType.EventRegistration && group.settings.allowRegistrationsByOrganization)
            ? new SelectableColumn({
                id: 'groupRegistration',
                name: $t('%8t'),
                enabled: false,
            })
            : null,
        groups.some(group => group.settings.trialDays)
            ? new SelectableColumn({
                id: 'trialUntil',
                name: $t(`%1IH`),
                enabled: false,
            })
            : null,
        // group
        ...groupColumns,
        ...((auth.hasSomePlatformAccess() && (organization === null || organization.id === platform.membershipOrganizationId || hasEvent))
            ? [
                    new SelectableColumn({
                        id: 'organization',
                        name: hasEvent ? $t('%cL') : $t('%5E'),
                        description: $t('%1Jh'),
                        enabled: false,
                    }),
                    new SelectableColumn({
                        id: 'uri',
                        name: hasEvent ? $t('%1KP') : $t('%7C'),
                        description: $t('%1Ji'),
                        enabled: false,
                    }),
                    new SelectableColumn({
                        id: 'member.organization',
                        name: $t('%1KQ'),
                        description: $t('%1KF'),
                        enabled: false,
                    }),
                    new SelectableColumn({
                        id: 'member.uri',
                        name: $t('%1KR'),
                        description: $t('%1Jk'),
                        enabled: false,
                    }),
                ]
            : []),
        ...organization === null || groups.length > 1
            ? [
                    new SelectableColumn({
                        id: 'defaultAgeGroup',
                        name: $t(`%wI`),
                        enabled: false,
                    }),
                    new SelectableColumn({
                        id: 'group',
                        name: $t(`%wH`),
                        enabled: false,
                    }),
                    groups.length === 0 || new Set(groups.map(g => g.type)).size > 1
                        ? new SelectableColumn({
                            id: 'group.type',
                            name: $t('%1LP'),
                            enabled: false,
                        })
                        : null,
                ]
            : [],
        // will always be 0 if organization is null
        organization !== null
            ? new SelectableColumn({
                id: 'outstandingBalance',
                name: $t(`%76`),
                description: $t('%184'),
                enabled: false,
            })
            : null,
        // price
        new SelectableColumn({
            id: 'priceName',
            name: $t(`%62`),
        }),
        new SelectableColumn({
            id: 'price',
            name: $t(`%1IP`),
        }),
        new SelectableColumn({
            id: 'toPay',
            name: $t(`%m0`),
            description: $t('%183'),
        }),
        new SelectableColumn({
            id: 'registeredAt',
            name: $t(`%zg`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'startDate',
            name: $t(`%7e`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'endDate',
            name: $t(`%wB`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'createdAt',
            name: $t('%1IG'),
            enabled: false,
        }),
        // id of registration
        new SelectableColumn({
            id: 'id',
            name: $t(`%1P`),
            description: $t('%174'),
            enabled: false,
        }),
        // parents
        ...[1, 2].flatMap((parentNumber, parentIndex) => {
            const getId = (value: string) => `member.parent.${parentIndex}.${value}`;
            const category = `Ouder ${parentNumber}`;
            const enabled = false;

            return [
                new SelectableColumn({
                    id: getId('type'),
                    name: $t(`%1B`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('firstName'),
                    name: $t(`%1MT`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('lastName'),
                    name: $t(`%1MU`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('phone'),
                    name: $t(`%wD`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('email'),
                    name: $t(`%1FK`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('address'),
                    name: $t(`%Cn`),
                    category,
                    enabled,

                }),
                returnNullIfNoAccessRight(new SelectableColumn({
                    id: getId('nationalRegisterNumber'),
                    name: $t(`%wK`),
                    category,
                    enabled,
                }), [AccessRight.MemberManageNRN]),
            ];
        }),

        // unverified data
        new SelectableColumn({
            id: 'member.unverifiedPhones',
            name: $t(`%ez`),
            category: $t(`%f0`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.unverifiedEmails',
            name: $t(`%vG`),
            category: $t(`%f0`),
            enabled: false,
        }),
        ...[1, 2].map((number, index) => {
            return new SelectableColumn({
                id: `member.unverifiedAddresses.${index}`,
                name: `Adres ${number}`,
                category: $t(`%f0`),
                enabled: false,
            });
        }),

        // record answers
        ...flattenedCategories.flatMap((category) => {
            return category.getAllRecords().flatMap((record) => {
                return new SelectableColumn({
                    id: `member.recordAnswers.${record.id}`,
                    name: record.name.toString(),
                    category: category.name.toString(),
                    description: record.description.toString(),
                    enabled: false,
                });
            });
        }),
    ].filter(column => column !== null);

    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'registrations',
                name: $t(`%1EI`),
                columns: columns.filter(column => column !== null),
            }),
        ],
    });
}
