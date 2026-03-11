import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import { ContextPermissions } from '@stamhoofd/networking';
import { AccessRight, FinancialSupportSettings, Group, GroupType, Organization, Platform, RecordCategory } from '@stamhoofd/structures';

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
                            name: menu.name + ' → ' + option.name + ' → ' + $t('697df3e7-fbbf-421d-81c2-9c904dce4842'),
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
            name: $t('a512b8a2-163c-4f69-94f7-ed9c1c3ab4f7'),
            description: $t(`b697f010-9b5f-4944-8cae-8c8649d2c2f2`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.memberNumber',
            name: $t(`123be534-a0be-4a6e-b03f-021659e1d8ba`),
        }),
        new SelectableColumn({
            id: 'member.firstName',
            name: $t(`603606c2-95ca-4967-814c-53ec3297bf33`),
        }),
        new SelectableColumn({
            id: 'member.lastName',
            name: $t(`033780e9-417d-4f0a-9aba-7ddfdf655d22`),
        }),
        new SelectableColumn({
            id: 'member.birthDay',
            name: $t(`00650ac3-eb78-4c8b-b7ec-d892772837a1`),
        }),
        new SelectableColumn({
            id: 'member.age',
            name: $t(`8c1f264f-3b0b-49b9-8a29-9ceb2dfd7754`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.gender',
            name: $t(`08ef39ff-3431-4975-8c46-8fb68c946432`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.phone',
            name: $t(`856aaa1c-bc62-4e45-9ae5-4c7e7dca23ab`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.email',
            name: $t(`237d0720-13f0-4029-8bf2-4de7e0a9a358`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.address',
            name: $t(`0a37de09-120b-4bea-8d13-6d7ed6823884`),
            description: $t(`01e99208-dce7-4109-8cf2-3cc74c4df45c`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.securityCode',
            name: $t(`0fa4253f-1cfd-4394-93b4-dfba8da04738`),
            enabled: false,
            description: $t(`aa45000f-8cff-4cb6-99b2-3202eb64c4a8`),
        }),
        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'member.requiresFinancialSupport',
            name: financialSupportTitle,
            enabled: false,
        }), [AccessRight.MemberReadFinancialData]),
        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'member.uitpasNumber',
            name: $t(`87c1a48c-fef5-44c3-ae56-c83463fcfb84`),
            enabled: false,
        }), [AccessRight.MemberReadFinancialData]),
        new SelectableColumn({
            id: 'member.notes',
            name: $t(`7f3af27c-f057-4ce3-8385-36dfb99745e8`),
            enabled: false,
        }),
        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'member.nationalRegisterNumber',
            name: $t(`00881b27-7501-4c56-98de-55618be2bf11`),
            enabled: false,
        }), [AccessRight.MemberManageNRN]),
        new SelectableColumn({
            id: 'member.membership',
            name: $t(`c0277e8e-a2e0-4ec3-9339-c2e1be2e6e2d`),
            enabled: false,
        }),
        groups.some(group => group.type === GroupType.EventRegistration && group.settings.allowRegistrationsByOrganization)
            ? new SelectableColumn({
                id: 'groupRegistration',
                name: $t('7289b10e-a284-40ea-bc57-8287c6566a82'),
                enabled: false,
            })
            : null,
        groups.some(group => group.settings.trialDays)
            ? new SelectableColumn({
                id: 'trialUntil',
                name: $t(`1f2e9d09-717b-4c17-9bbe-dce3f3dcbff0`),
                enabled: false,
            })
            : null,
        // group
        ...groupColumns,
        ...((auth.hasSomePlatformAccess() && (organization === null || organization.id === platform.membershipOrganizationId || hasEvent))
            ? [
                    new SelectableColumn({
                        id: 'organization',
                        name: hasEvent ? $t('55e86a73-d637-4ca0-82ac-abd27d60705f') : $t('2f325358-6e2f-418c-9fea-31a14abbc17a'),
                        description: $t('517e056d-b0f7-4103-b717-5550c0c38cff'),
                        enabled: false,
                    }),
                    new SelectableColumn({
                        id: 'uri',
                        name: hasEvent ? $t('33baaf22-e844-4de1-960e-fc2dec76b5f1') : $t('05723781-9357-41b2-9fb8-cb4f80dde7f9'),
                        description: $t('983d267c-b44b-40bd-b0b6-565032ab01a9'),
                        enabled: false,
                    }),
                    new SelectableColumn({
                        id: 'member.organization',
                        name: $t('5a1993a8-2604-4ca5-be6e-8d6902d9f8c1'),
                        description: $t('84f2ae7b-1ead-4d0f-9343-a4ed51b5e624'),
                        enabled: false,
                    }),
                    new SelectableColumn({
                        id: 'member.uri',
                        name: $t('068b0bcf-f269-4425-8a48-89ad156d6fad'),
                        description: $t('e8dd32de-9708-4e77-ad38-fdd28b53d5b9'),
                        enabled: false,
                    }),
                ]
            : []),
        ...organization === null || groups.length > 1
            ? [
                    new SelectableColumn({
                        id: 'defaultAgeGroup',
                        name: $t(`0ef2bbb3-0b3c-411a-8901-a454cff1f839`),
                        enabled: false,
                    }),
                    new SelectableColumn({
                        id: 'group',
                        name: $t(`0c230001-c3be-4a8e-8eab-23dc3fd96e52`),
                        enabled: false,
                    }),
                    groups.length === 0 || new Set(groups.map(g => g.type)).size > 1
                        ? new SelectableColumn({
                            id: 'group.type',
                            name: $t('23671282-34da-4da9-8afd-503811621055'),
                            enabled: false,
                        })
                        : null,
                ]
            : [],
        // will always be 0 if organization is null
        organization !== null
            ? new SelectableColumn({
                id: 'outstandingBalance',
                name: $t(`28c2bc66-231f-44f3-9249-c1981b871a1f`),
                description: $t('6c5de33a-dbbd-4b9c-866d-104e007836b3'),
                enabled: false,
            })
            : null,
        // price
        new SelectableColumn({
            id: 'priceName',
            name: $t(`a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc`),
        }),
        new SelectableColumn({
            id: 'price',
            name: $t(`1205deb9-498d-435d-a6e1-91ea98371523`),
        }),
        new SelectableColumn({
            id: 'toPay',
            name: $t(`18aed6d0-0880-4d06-9260-fe342e6e8064`),
            description: $t('7a8d174e-2807-4ada-ad94-6f519edc9c14'),
        }),
        new SelectableColumn({
            id: 'registeredAt',
            name: $t(`8895f354-658f-48bd-9d5d-2e0203ca2a36`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'startDate',
            name: $t(`300d2935-b578-48cc-b58e-1c0446a68d59`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'endDate',
            name: $t(`3c90169c-9776-4d40-bda0-dba27a5bad69`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'createdAt',
            name: $t('63a86cdf-8a76-4e8c-9073-4f0b8970e808'),
            enabled: false,
        }),
        // id of registration
        new SelectableColumn({
            id: 'id',
            name: $t(`8daf57de-69cf-48fe-b09b-772c54473184`),
            description: $t('2428a4da-4d23-4ff3-9194-9dbe17134dcc'),
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
                    name: $t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('firstName'),
                    name: $t(`603606c2-95ca-4967-814c-53ec3297bf33`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('lastName'),
                    name: $t(`033780e9-417d-4f0a-9aba-7ddfdf655d22`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('phone'),
                    name: $t(`856aaa1c-bc62-4e45-9ae5-4c7e7dca23ab`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('email'),
                    name: $t(`237d0720-13f0-4029-8bf2-4de7e0a9a358`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('address'),
                    name: $t(`0a37de09-120b-4bea-8d13-6d7ed6823884`),
                    category,
                    enabled,

                }),
                returnNullIfNoAccessRight(new SelectableColumn({
                    id: getId('nationalRegisterNumber'),
                    name: $t(`00881b27-7501-4c56-98de-55618be2bf11`),
                    category,
                    enabled,
                }), [AccessRight.MemberManageNRN]),
            ];
        }),

        // unverified data
        new SelectableColumn({
            id: 'member.unverifiedPhones',
            name: $t(`62ce5fa4-3ea4-4fa8-a495-ff5eef1ec5d4`),
            category: $t(`94823cfc-f583-4288-bf44-0a7cfec9e61f`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.unverifiedEmails',
            name: $t(`1363c0ee-0f4b-43f8-a9ee-a2a6091e5d96`),
            category: $t(`94823cfc-f583-4288-bf44-0a7cfec9e61f`),
            enabled: false,
        }),
        ...[1, 2].map((number, index) => {
            return new SelectableColumn({
                id: `member.unverifiedAddresses.${index}`,
                name: `Adres ${number}`,
                category: $t(`94823cfc-f583-4288-bf44-0a7cfec9e61f`),
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
                name: $t(`3f4c9896-7f02-4b49-ad29-2d363a8af71f`),
                columns: columns.filter(column => column !== null),
            }),
        ],
    });
}
