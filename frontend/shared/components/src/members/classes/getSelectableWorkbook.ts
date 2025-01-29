import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import { FinancialSupportSettings, Group, Organization, Platform, RecordCategory } from '@stamhoofd/structures';

// , permissions?: UserPermissions|null
export function getSelectableWorkbook(platform: Platform, organization: Organization | null, groups: Group[] = []) {
    const recordCategories = [
        ...(organization?.meta.recordsConfiguration.recordCategories ?? []),
        ...platform.config.recordsConfiguration.recordCategories,
    ];

    // todo: check permissions
    // const recordsConfiguration = OrganizationRecordsConfiguration.build({platform, organization});
    const financialSupportSettings = platform.config.financialSupport ?? FinancialSupportSettings.create({});
    const financialSupportTitle = financialSupportSettings.title;

    const flattenedCategories = RecordCategory.flattenCategoriesWith(recordCategories, r => r.excelColumns.length > 0);

    const groupColumns: SelectableColumn[] = [];

    for (const group of groups) {
        if (group.settings.prices.length > 1) {
            groupColumns.push(
                new SelectableColumn({
                    id: `groups.${group.id}.price`,
                    name: 'Tarief',
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
                            name: menu.name + ' → Aantal "' + option.name + '"',
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

    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'members',
                name: 'Leden',
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: 'ID',
                        description: 'Unieke identificatie van het lid',
                        enabled: false,
                    }),

                    // todo: only if platform?
                    new SelectableColumn({
                        id: 'memberNumber',
                        name: 'Nummer',
                        description: 'Nummer van het lid',
                    }),

                    new SelectableColumn({
                        id: 'firstName',
                        name: 'Voornaam',
                    }),

                    new SelectableColumn({
                        id: 'lastName',
                        name: 'Achternaam',
                    }),

                    new SelectableColumn({
                        id: 'birthDay',
                        name: 'Geboortedatum',
                    }),

                    new SelectableColumn({
                        id: 'age',
                        name: 'Leeftijd',
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'gender',
                        name: 'Geslacht',
                    }),

                    new SelectableColumn({
                        id: 'phone',
                        name: 'Telefoonnummer',
                    }),

                    new SelectableColumn({
                        id: 'email',
                        name: 'E-mailadres',
                    }),

                    new SelectableColumn({
                        id: 'address',
                        name: 'Adres',
                        description: 'Adres van het lid, of het adres van de eerste ouder met een adres.',
                    }),

                    new SelectableColumn({
                        id: 'securityCode',
                        name: 'Beveiligingscode',
                        enabled: false,
                        description: 'Code om een onbekende gebruiker toegang te geven tot een lid.',
                    }),

                    new SelectableColumn({
                        id: 'requiresFinancialSupport',
                        name: financialSupportTitle,
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'uitpasNumber',
                        name: 'UiTPAS-nummer',
                    }),

                    new SelectableColumn({
                        id: 'notes',
                        name: 'Notities',
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'nationalRegisterNumber',
                        name: 'Rijksregisternummer',
                    }),

                    ...groupColumns,

                    ...(!organization
                        ? [
                                new SelectableColumn({
                                    id: 'organization',
                                    name: 'Groep',
                                    enabled: false,
                                }),
                                new SelectableColumn({
                                    id: 'uri',
                                    name: 'Groepsnummer',
                                    enabled: false,
                                }),
                                new SelectableColumn({
                                    id: 'defaultAgeGroup',
                                    name: 'Standaard leeftijdsgroep',
                                    enabled: false,
                                }),
                            ]
                        : []),

                    ...(organization
                        ? [
                                new SelectableColumn({
                                    id: 'group',
                                    name: 'Leeftijdsgroep',
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
                                name: 'Type ' + category,
                                category,
                                enabled,
                            }),
                            new SelectableColumn({
                                id: getId('firstName'),
                                name: 'Voornaam ' + category,
                                category,
                                enabled,
                            }),
                            new SelectableColumn({
                                id: getId('lastName'),
                                name: 'Achternaam ' + category,
                                category,
                                enabled,
                            }),
                            new SelectableColumn({
                                id: getId('phone'),
                                name: 'Telefoonnummer ' + category,
                                category,
                                enabled,
                            }),

                            new SelectableColumn({
                                id: getId('email'),
                                name: 'E-mailadres ' + category,
                                category,
                                enabled,
                            }),
                            new SelectableColumn({
                                id: getId('address'),
                                name: 'Adres ' + category,
                                category,
                                enabled,
                            }),
                            new SelectableColumn({
                                id: getId('nationalRegisterNumber'),
                                name: 'Rijksregisternummer ' + category,
                                category,
                                enabled,
                            }),
                        ];
                    }),

                    new SelectableColumn({
                        id: 'unverifiedPhones',
                        name: 'Telefoonnummers',
                        category: 'Niet-geverifieerde gegevens',
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'unverifiedEmails',
                        name: 'E-mailadressen',
                        category: 'Niet-geverifieerde gegevens',
                        enabled: false,
                    }),

                    ...[1, 2].map((number, index) => {
                        return new SelectableColumn({
                            id: `unverifiedAddresses.${index}`,
                            name: `Adres ${number}`,
                            category: 'Niet-geverifieerde gegevens',
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
                ],
            }),
        ],
    });
}
