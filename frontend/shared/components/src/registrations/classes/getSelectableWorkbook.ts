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
                            name: menu.name + ' → ' + option.name + ' → ' + $t('ed55e67d-1dce-46b2-8250-948c7cd616c2'),
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
            name: $t(`7c4ca473-3c49-45fb-bdd2-b87399a69e62`),
        }),
        new SelectableColumn({
            id: 'member.firstName',
            name: $t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`),
        }),
        new SelectableColumn({
            id: 'member.lastName',
            name: $t(`171bd1df-ed4b-417f-8c5e-0546d948469a`),
        }),
        new SelectableColumn({
            id: 'member.birthDay',
            name: $t(`f3b87bd8-e36c-4fb8-917f-87b18ece750e`),
        }),
        new SelectableColumn({
            id: 'member.age',
            name: $t(`e96d9ea7-f8cc-42c6-b23d-f46e1a56e043`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.gender',
            name: $t(`3048ad16-fd3b-480e-b458-10365339926b`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.phone',
            name: $t(`de70b659-718d-445a-9dca-4d14e0a7a4ec`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.email',
            name: $t(`7400cdce-dfb4-40e7-996b-4817385be8d8`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.address',
            name: $t(`f7e792ed-2265-41e9-845f-e3ce0bc5da7c`),
            description: $t(`01e99208-dce7-4109-8cf2-3cc74c4df45c`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'member.securityCode',
            name: $t(`ba5f8036-1788-408a-8c44-1db80a53c087`),
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
            name: $t(`d70f2a7f-d8b4-4846-8dc0-a8e978765b9d`),
            enabled: false,
        }), [AccessRight.MemberReadFinancialData]),
        new SelectableColumn({
            id: 'member.notes',
            name: $t(`7f3af27c-f057-4ce3-8385-36dfb99745e8`),
            enabled: false,
        }),
        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'member.nationalRegisterNumber',
            name: $t(`439176a5-dd35-476b-8c65-3216560cac2f`),
            enabled: false,
        }), [AccessRight.MemberManageNRN]),
        new SelectableColumn({
            id: 'member.membership',
            name: $t(`c7d995f1-36a0-446e-9fcf-17ffb69f3f45`),
            enabled: false,
        }),
        groups.some(group => group.type === GroupType.EventRegistration && group.settings.allowRegistrationsByOrganization)
            ? new SelectableColumn({
                id: 'groupRegistration',
                name: $t('7289b10e-a284-40ea-bc57-8287c6566a82'),
                enabled: false,
            })
            : null,

        // group
        ...groupColumns,
        ...((organization === null || organization.id === platform.membershipOrganizationId)
            ? [
                    new SelectableColumn({
                        id: 'organization',
                        name: $t(`a0b1e726-345d-4288-a1db-7437d1b47482`),
                        enabled: false,
                    }),
                    new SelectableColumn({
                        id: 'uri',
                        name: $t(`4c61c43e-ed3c-418e-8773-681d19323520`),
                        enabled: false,
                    }),
                ]
            : []),
        ...organization === null || groups.length > 0
            ? [
                    new SelectableColumn({
                        id: 'defaultAgeGroup',
                        name: $t(`494ad9b9-c644-4b71-bd38-d6845706231f`),
                        enabled: false,
                    }),
                    new SelectableColumn({
                        id: 'group',
                        name: $t(`fb629dba-088e-4c97-b201-49787bcda0ac`),
                        enabled: false,
                    }),
                ]
            : [],
        // will always be 0 if organization is null
        organization !== null
            ? new SelectableColumn({
                id: 'outstandingBalance',
                name: $t(`beb45452-dee7-4a7f-956c-e6db06aac20f`),
                description: $t('6c5de33a-dbbd-4b9c-866d-104e007836b3'),
                enabled: false,
            })
            : null,
        // price
        new SelectableColumn({
            id: 'priceName',
            name: $t(`ae21b9bf-7441-4f38-b789-58f34612b7af`),
        }),
        new SelectableColumn({
            id: 'price',
            name: $t(`Prijs`),
        }),
        new SelectableColumn({
            id: 'toPay',
            name: $t(`3a97e6cb-012d-4007-9c54-49d3e5b72909`),
            description: $t('7a8d174e-2807-4ada-ad94-6f519edc9c14'),
        }),
        new SelectableColumn({
            id: 'registeredAt',
            name: $t(`Inschrijvingsdatum`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'startDate',
            name: $t(`bbe0af99-b574-4719-a505-ca2285fa86e4`),
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
                    name: $t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('lastName'),
                    name: $t(`171bd1df-ed4b-417f-8c5e-0546d948469a`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('phone'),
                    name: $t(`de70b659-718d-445a-9dca-4d14e0a7a4ec`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('email'),
                    name: $t(`7400cdce-dfb4-40e7-996b-4817385be8d8`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('address'),
                    name: $t(`f7e792ed-2265-41e9-845f-e3ce0bc5da7c`),
                    category,
                    enabled,

                }),
                returnNullIfNoAccessRight(new SelectableColumn({
                    id: getId('nationalRegisterNumber'),
                    name: $t(`439176a5-dd35-476b-8c65-3216560cac2f`),
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
            name: $t(`7766ee8a-cd92-4d6f-a3fa-f79504fbcdda`),
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
