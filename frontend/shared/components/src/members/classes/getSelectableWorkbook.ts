import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import { ContextPermissions } from '@stamhoofd/networking';
import { AccessRight, FinancialSupportSettings, Group, Organization, Platform, RecordCategory } from '@stamhoofd/structures';

export function getSelectableColumns({ platform, organization, auth, groupColumns }: { platform: Platform; organization: Organization | null; auth: ContextPermissions; groupColumns?: SelectableColumn[] }) {
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

    const columns: SelectableColumn[] = [
        // member
        new SelectableColumn({
            id: 'id',
            name: $t(`8daf57de-69cf-48fe-b09b-772c54473184`),
            description: $t(`b697f010-9b5f-4944-8cae-8c8649d2c2f2`),
            enabled: false,
        }),
        // todo: only if platform?
        new SelectableColumn({
            id: 'memberNumber',
            name: $t(`7c4ca473-3c49-45fb-bdd2-b87399a69e62`),
        }),
        new SelectableColumn({
            id: 'firstName',
            name: $t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`),
        }),
        new SelectableColumn({
            id: 'lastName',
            name: $t(`171bd1df-ed4b-417f-8c5e-0546d948469a`),
        }),
        new SelectableColumn({
            id: 'birthDay',
            name: $t(`f3b87bd8-e36c-4fb8-917f-87b18ece750e`),
        }),
        new SelectableColumn({
            id: 'age',
            name: $t(`e96d9ea7-f8cc-42c6-b23d-f46e1a56e043`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'gender',
            name: $t(`3048ad16-fd3b-480e-b458-10365339926b`),
        }),
        new SelectableColumn({
            id: 'phone',
            name: $t(`de70b659-718d-445a-9dca-4d14e0a7a4ec`),
        }),
        new SelectableColumn({
            id: 'email',
            name: $t(`7400cdce-dfb4-40e7-996b-4817385be8d8`),
        }),
        new SelectableColumn({
            id: 'address',
            name: $t(`f7e792ed-2265-41e9-845f-e3ce0bc5da7c`),
            description: $t(`01e99208-dce7-4109-8cf2-3cc74c4df45c`),
        }),
        new SelectableColumn({
            id: 'securityCode',
            name: $t(`ba5f8036-1788-408a-8c44-1db80a53c087`),
            enabled: false,
            description: $t(`aa45000f-8cff-4cb6-99b2-3202eb64c4a8`),
        }),
        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'requiresFinancialSupport',
            name: financialSupportTitle,
            enabled: false,
        }), [AccessRight.MemberReadFinancialData]),
        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'uitpasNumber',
            name: $t(`d70f2a7f-d8b4-4846-8dc0-a8e978765b9d`),
        }), [AccessRight.MemberReadFinancialData]),
        new SelectableColumn({
            id: 'notes',
            name: $t(`7f3af27c-f057-4ce3-8385-36dfb99745e8`),
            enabled: false,
        }),
        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'nationalRegisterNumber',
            name: $t(`439176a5-dd35-476b-8c65-3216560cac2f`),
        }), [AccessRight.MemberManageNRN]),

        // group
        ...(groupColumns ?? []),
        ...((organization === null)
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
        // will always be 0 if organization is null
        organization !== null
            ? new SelectableColumn({
                id: 'outstandingBalance',
                name: $t(`beb45452-dee7-4a7f-956c-e6db06aac20f`),
                description: $t('6c5de33a-dbbd-4b9c-866d-104e007836b3'),
                enabled: false,
            })
            : null,

        // parents
        ...[1, 2].flatMap((parentNumber, parentIndex) => {
            const getId = (value: string) => `parent.${parentIndex}.${value}`;
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
            id: 'unverifiedPhones',
            name: $t(`62ce5fa4-3ea4-4fa8-a495-ff5eef1ec5d4`),
            category: $t(`94823cfc-f583-4288-bf44-0a7cfec9e61f`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'unverifiedEmails',
            name: $t(`7766ee8a-cd92-4d6f-a3fa-f79504fbcdda`),
            category: $t(`94823cfc-f583-4288-bf44-0a7cfec9e61f`),
            enabled: false,
        }),
        ...[1, 2].map((number, index) => {
            return new SelectableColumn({
                id: `unverifiedAddresses.${index}`,
                name: `Adres ${number}`,
                category: $t(`94823cfc-f583-4288-bf44-0a7cfec9e61f`),
                enabled: false,
            });
        }),

        // record answers
        ...flattenedCategories.flatMap((category) => {
            return category.getAllRecords().flatMap((record) => {
                return new SelectableColumn({
                    id: `recordAnswers.${record.id}`,
                    name: record.name.toString(),
                    category: category.name.toString(),
                    description: record.description.toString(),
                });
            });
        }),
    ].filter(column => column !== null);

    return columns;
}

export function getSelectableGroupColumns(groups: Group[] = []) {
    const groupColumns: SelectableColumn[] = [];

    for (const group of groups) {
        if (group.settings.prices.length > 1) {
            groupColumns.push(
                new SelectableColumn({
                    id: `groups.${group.id}.price`,
                    name: $t(`ae21b9bf-7441-4f38-b789-58f34612b7af`),
                    category: group.settings.name.toString(),
                }),
            );
        }

        for (const menu of group.settings.optionMenus) {
            groupColumns.push(
                new SelectableColumn({
                    id: `groups.${group.id}.optionMenu.${menu.id}`,
                    name: menu.name,
                    category: group.settings.name.toString(),
                }),
            );

            for (const option of menu.options) {
                if (option.allowAmount) {
                    groupColumns.push(
                        new SelectableColumn({
                            id: `groups.${group.id}.optionMenu.${menu.id}.${option.id}.amount`,
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
                        id: `groups.${group.id}.recordAnswers.${record.id}`,
                        name: recordCategory.name + ' → ' + record.name,
                        category: group.settings.name.toString(),
                    }),
                );
            }
        }
    }

    return groupColumns;
}

export function getAllSelectableColumns(args: { platform: Platform; organization: Organization | null; groups?: Group[]; auth: ContextPermissions }) {
    const groupColumns = getSelectableGroupColumns(args.groups ?? []);
    return getSelectableColumns({ ...args, groupColumns });
}

// , permissions?: UserPermissions|null
export function getSelectableWorkbook(platform: Platform, organization: Organization | null, groups: Group[] = [], auth: ContextPermissions) {
    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'members',
                name: $t(`97dc1e85-339a-4153-9413-cca69959d731`),
                columns: getAllSelectableColumns({ platform, organization, groups, auth }),
            }),
        ],
    });
}
