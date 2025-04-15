import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import { ContextPermissions } from '@stamhoofd/networking';
import { AccessRight, FinancialSupportSettings, Group, Organization, Platform, RecordCategory } from '@stamhoofd/structures';

// , permissions?: UserPermissions|null
export function getSelectableWorkbook(platform: Platform, organization: Organization | null, groups: Group[] = [], auth: ContextPermissions) {
    const recordCategories = [
        ...(organization?.meta.recordsConfiguration.recordCategories ?? []),
        ...platform.config.recordsConfiguration.recordCategories,
    ];

    const financialSupportSettings = platform.config.financialSupport ?? FinancialSupportSettings.create({});
    const financialSupportTitle = financialSupportSettings.title;

    const flattenedCategories = RecordCategory.flattenCategoriesWith(recordCategories, r => r.excelColumns.length > 0);

    const groupColumns: SelectableColumn[] = [];

    for (const group of groups) {
        if (group.settings.prices.length > 1) {
            groupColumns.push(
                new SelectableColumn({
                    id: `groups.${group.id}.price`,
                    name: $t(`Tarief`),
                    category: group.settings.name,
                }),
            );
        }

        for (const menu of group.settings.optionMenus) {
            groupColumns.push(
                new SelectableColumn({
                    id: `groups.${group.id}.optionMenu.${menu.id}`,
                    name: menu.name,
                    category: group.settings.name,
                }),
            );

            for (const option of menu.options) {
                if (option.allowAmount) {
                    groupColumns.push(
                        new SelectableColumn({
                            id: `groups.${group.id}.optionMenu.${menu.id}.${option.id}.amount`,
                            name: menu.name + ' ' + $t(`→ Aantal "`) + option.name + '"',
                            category: group.settings.name,
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
                        category: group.settings.name,
                    }),
                );
            }
        }
    }

    const returnNullIfNoAccessRight = (column: SelectableColumn, requiresAccessRights: AccessRight[]) => {
        if (requiresAccessRights.some(accessRight => !auth.hasAccessRight(accessRight))) {
            return null;
        }

        return column;
    };

    const columns: (SelectableColumn | null) [] = [
        new SelectableColumn({
            id: 'id',
            name: $t(`ID`),
            description: $t(`Unieke identificatie van het lid`),
            enabled: false,
        }),

        // todo: only if platform?
        new SelectableColumn({
            id: 'memberNumber',
            name: $t(`Nummer`),
            description: $t(`Nummer van het lid`),
        }),

        new SelectableColumn({
            id: 'firstName',
            name: $t(`Voornaam`),
        }),

        new SelectableColumn({
            id: 'lastName',
            name: $t(`Achternaam`),
        }),

        new SelectableColumn({
            id: 'birthDay',
            name: $t(`Geboortedatum`),
        }),

        new SelectableColumn({
            id: 'age',
            name: $t(`Leeftijd`),
            enabled: false,
        }),

        new SelectableColumn({
            id: 'gender',
            name: $t(`Geslacht`),
        }),

        new SelectableColumn({
            id: 'phone',
            name: $t(`Telefoonnummer`),
        }),

        new SelectableColumn({
            id: 'email',
            name: $t(`E-mailadres`),
        }),

        new SelectableColumn({
            id: 'address',
            name: $t(`Adres`),
            description: $t(`Adres van het lid, of het adres van de eerste ouder met een adres.`),
        }),

        new SelectableColumn({
            id: 'securityCode',
            name: $t(`Beveiligingscode`),
            enabled: false,
            description: $t(`Code om een onbekende gebruiker toegang te geven tot een lid.`),
        }),

        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'requiresFinancialSupport',
            name: financialSupportTitle,
            enabled: false,
        }), [AccessRight.MemberReadFinancialData]),

        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'uitpasNumber',
            name: $t(`UiTPAS-nummer`),
        }), [AccessRight.MemberReadFinancialData]),

        new SelectableColumn({
            id: 'notes',
            name: $t(`Notities`),
            enabled: false,
        }),

        returnNullIfNoAccessRight(new SelectableColumn({
            id: 'nationalRegisterNumber',
            name: $t(`Rijksregisternummer`),
        }), [AccessRight.MemberManageNRN]),

        ...groupColumns,

        ...(!organization
            ? [
                    new SelectableColumn({
                        id: 'organization',
                        name: $t(`Groep`),
                        enabled: false,
                    }),
                    new SelectableColumn({
                        id: 'uri',
                        name: $t(`Groepsnummer`),
                        enabled: false,
                    }),
                    new SelectableColumn({
                        id: 'defaultAgeGroup',
                        name: $t(`Standaard leeftijdsgroep`),
                        enabled: false,
                    }),
                ]
            : []),

        ...(organization
            ? [
                    new SelectableColumn({
                        id: 'group',
                        name: $t(`Leeftijdsgroep`),
                        enabled: false,
                    }),
                ]
            : []),

        ...[1, 2].flatMap((parentNumber, parentIndex) => {
            const getId = (value: string) => `parent.${parentIndex}.${value}`;
            const category = `Ouder ${parentNumber}`;
            const enabled = false;

            return [
                new SelectableColumn({
                    id: getId('type'),
                    name: $t(`Type`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('firstName'),
                    name: $t(`Voornaam`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('lastName'),
                    name: $t(`Achternaam`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('phone'),
                    name: $t(`Telefoonnummer`),
                    category,
                    enabled,
                }),

                new SelectableColumn({
                    id: getId('email'),
                    name: $t(`E-mailadres`),
                    category,
                    enabled,
                }),
                new SelectableColumn({
                    id: getId('address'),
                    name: $t(`Adres`),
                    category,
                    enabled,
                }),
                returnNullIfNoAccessRight(new SelectableColumn({
                    id: getId('nationalRegisterNumber'),
                    name: $t(`Rijksregisternummer`),
                    category,
                    enabled,
                }), [AccessRight.MemberManageNRN]),
            ];
        }),

        new SelectableColumn({
            id: 'unverifiedPhones',
            name: $t(`Telefoonnummers`),
            category: $t(`Niet-geverifieerde gegevens`),
            enabled: false,
        }),

        new SelectableColumn({
            id: 'unverifiedEmails',
            name: $t(`E-mailadressen`),
            category: $t(`Niet-geverifieerde gegevens`),
            enabled: false,
        }),

        ...[1, 2].map((number, index) => {
            return new SelectableColumn({
                id: `unverifiedAddresses.${index}`,
                name: `Adres ${number}`,
                category: $t(`Niet-geverifieerde gegevens`),
                enabled: false,
            });
        }),

        ...flattenedCategories.flatMap((category) => {
            return category.getAllRecords().flatMap((record) => {
                return new SelectableColumn({
                    id: `recordAnswers.${record.id}`,
                    name: record.name,
                    category: category.name,
                    description: record.description,
                });
            });
        }),
    ];

    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'members',
                name: $t(`Leden`),
                columns: columns.filter(column => column !== null),
            }),
        ],
    });
}
