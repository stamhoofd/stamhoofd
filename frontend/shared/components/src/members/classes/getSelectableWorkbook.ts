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
            name: $t(`123be534-a0be-4a6e-b03f-021659e1d8ba`),
        }),
        new SelectableColumn({
            id: 'firstName',
            name: $t(`603606c2-95ca-4967-814c-53ec3297bf33`),
        }),
        new SelectableColumn({
            id: 'lastName',
            name: $t(`033780e9-417d-4f0a-9aba-7ddfdf655d22`),
        }),
        new SelectableColumn({
            id: 'birthDay',
            name: $t(`00650ac3-eb78-4c8b-b7ec-d892772837a1`),
        }),
        new SelectableColumn({
            id: 'age',
            name: $t(`8c1f264f-3b0b-49b9-8a29-9ceb2dfd7754`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'gender',
            name: $t(`08ef39ff-3431-4975-8c46-8fb68c946432`),
        }),
        new SelectableColumn({
            id: 'phone',
            name: $t(`856aaa1c-bc62-4e45-9ae5-4c7e7dca23ab`),
        }),
        new SelectableColumn({
            id: 'email',
            name: $t(`237d0720-13f0-4029-8bf2-4de7e0a9a358`),
        }),
        new SelectableColumn({
            id: 'address',
            name: $t(`0a37de09-120b-4bea-8d13-6d7ed6823884`),
            description: $t(`01e99208-dce7-4109-8cf2-3cc74c4df45c`),
        }),
        new SelectableColumn({
            id: 'securityCode',
            name: $t(`0fa4253f-1cfd-4394-93b4-dfba8da04738`),
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
            name: $t(`87c1a48c-fef5-44c3-ae56-c83463fcfb84`),
        }), [AccessRight.MemberReadFinancialData]),
        new SelectableColumn({
            id: 'notes',
            name: $t(`7f3af27c-f057-4ce3-8385-36dfb99745e8`),
            enabled: false,
        }),
        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'nationalRegisterNumber',
            name: $t(`00881b27-7501-4c56-98de-55618be2bf11`),
        }), [AccessRight.MemberManageNRN]),

        // group
        ...(groupColumns ?? []),
        ...((organization === null || organization.id === platform.membershipOrganizationId)
            ? [
                    new SelectableColumn({
                        id: 'organization',
                        name: $t(`a0b1e726-345d-4288-a1db-7437d1b47482`),
                        enabled: false,
                    }),
                    new SelectableColumn({
                        id: 'uri',
                        name: $t(`05723781-9357-41b2-9fb8-cb4f80dde7f9`),
                        enabled: false,
                    }),
                ]
            : []),
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
        // will always be 0 if organization is null
        organization !== null
            ? new SelectableColumn({
                id: 'outstandingBalance',
                name: $t(`28c2bc66-231f-44f3-9249-c1981b871a1f`),
                description: $t('6c5de33a-dbbd-4b9c-866d-104e007836b3'),
                enabled: false,
            })
            : null,
        new SelectableColumn({
            id: 'createdAt',
            name: $t('6711ac76-e8c7-482b-b6b4-635ba3d16f60'),
            enabled: false,
        }),

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
            id: 'unverifiedPhones',
            name: $t(`62ce5fa4-3ea4-4fa8-a495-ff5eef1ec5d4`),
            category: $t(`94823cfc-f583-4288-bf44-0a7cfec9e61f`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'unverifiedEmails',
            name: $t(`1363c0ee-0f4b-43f8-a9ee-a2a6091e5d96`),
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
                    name: $t(`a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc`),
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
                name: $t(`19da8d23-acea-43c2-bfdd-742447ca57f1`),
                columns: getAllSelectableColumns({ platform, organization, groups, auth }),
            }),
        ],
    });
}
