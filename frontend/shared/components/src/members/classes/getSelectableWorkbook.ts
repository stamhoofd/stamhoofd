import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import type { ContextPermissions } from '@stamhoofd/networking/ContextPermissions';
import type { Group, Organization, Platform} from '@stamhoofd/structures';
import { AccessRight, FinancialSupportSettings, RecordCategory } from '@stamhoofd/structures';

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
            name: $t(`%1P`),
            description: $t(`%ev`),
            enabled: false,
        }),
        // todo: only if platform?
        new SelectableColumn({
            id: 'memberNumber',
            name: $t(`%19j`),
        }),
        new SelectableColumn({
            id: 'firstName',
            name: $t(`%1MT`),
        }),
        new SelectableColumn({
            id: 'lastName',
            name: $t(`%1MU`),
        }),
        new SelectableColumn({
            id: 'birthDay',
            name: $t(`%17w`),
        }),
        new SelectableColumn({
            id: 'age',
            name: $t(`%9S`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'gender',
            name: $t(`%19i`),
        }),
        new SelectableColumn({
            id: 'phone',
            name: $t(`%wD`),
        }),
        new SelectableColumn({
            id: 'email',
            name: $t(`%1FK`),
        }),
        new SelectableColumn({
            id: 'address',
            name: $t(`%Cn`),
            description: $t(`%ew`),
        }),
        new SelectableColumn({
            id: 'securityCode',
            name: $t(`%wE`),
            enabled: false,
            description: $t(`%ex`),
        }),
        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'requiresFinancialSupport',
            name: financialSupportTitle,
            enabled: false,
        }), [AccessRight.MemberReadFinancialData]),
        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'uitpasNumber',
            name: $t(`%wF`),
        }), [AccessRight.MemberReadFinancialData]),
        new SelectableColumn({
            id: 'notes',
            name: $t(`%Ve`),
            enabled: false,
        }),
        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'nationalRegisterNumber',
            name: $t(`%wK`),
        }), [AccessRight.MemberManageNRN]),

        // group
        ...(groupColumns ?? []),
        ...((organization === null || organization.id === platform.membershipOrganizationId)
            ? [
                    new SelectableColumn({
                        id: 'organization',
                        name: $t(`%ey`),
                        enabled: false,
                    }),
                    new SelectableColumn({
                        id: 'uri',
                        name: $t(`%1O1`),
                        enabled: false,
                    }),
                ]
            : []),
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
        // will always be 0 if organization is null
        organization !== null
            ? new SelectableColumn({
                id: 'outstandingBalance',
                name: $t(`%76`),
                description: $t('%184'),
                enabled: false,
            })
            : null,
        new SelectableColumn({
            id: 'createdAt',
            name: $t('%1Jc'),
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
            id: 'unverifiedPhones',
            name: $t(`%ez`),
            category: $t(`%f0`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'unverifiedEmails',
            name: $t(`%vG`),
            category: $t(`%f0`),
            enabled: false,
        }),
        ...[1, 2].map((number, index) => {
            return new SelectableColumn({
                id: `unverifiedAddresses.${index}`,
                name: `Adres ${number}`,
                category: $t(`%f0`),
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
                    name: $t(`%62`),
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
                name: $t(`%1EH`),
                columns: getAllSelectableColumns({ platform, organization, groups, auth }),
            }),
        ],
    });
}
