import { SelectableColumn, SelectableSheet, SelectableWorkbook } from "@stamhoofd/frontend-excel-export";
import { Organization, Platform, RecordCategory } from "@stamhoofd/structures";

export function getSelectableWorkbook(platform: Platform, organization: Organization | null) {
    const recordCategories = [
        ...(organization?.meta.recordsConfiguration.recordCategories ?? []),
        ...platform.config.recordsConfiguration.recordCategories
    ]

    const flattenedCategories = RecordCategory.flattenCategoriesWith(recordCategories, (r) => r.excelColumns.length > 0)

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
                        enabled: false
                    }),

                    // todo: only if platform?
                    new SelectableColumn({
                        id: 'memberNumber',
                        name: 'Nummer',
                        description: 'Nummer van het lid',
                    }),

                    new SelectableColumn({
                        id: 'firstName',
                        name: 'Voornaam'
                    }),

                    new SelectableColumn({
                        id: 'lastName',
                        name: 'Achternaam'
                    }),

                    new SelectableColumn({
                        id: 'birthDay',
                        name: 'Geboortedatum'
                    }),

                    new SelectableColumn({
                        id: 'gender',
                        name: 'Geslacht'
                    }),

                    new SelectableColumn({
                        id: 'uitpasNumber',
                        name: 'UiTPAS-nummer'
                    }),

                    new SelectableColumn({
                        id: 'phone',
                        name: 'Telefoonnummer'
                    }),

                    new SelectableColumn({
                        id: 'email',
                        name: 'E-mailadres'
                    }),

                    new SelectableColumn({
                        id: 'address',
                        name: 'Adres',
                        description: 'Adres van het lid, of het adres van de eerste ouder met een adres.'
                    }),

                    new SelectableColumn({
                        id: 'securityCode',
                        name: 'Beveiligingscode',
                        enabled: false,
                        description: 'Code om een onbekende gebruiker toegang te geven tot een lid.'
                    }),

                    ...[1,2].flatMap((parentNumber, parentIndex) => {
                        const getId = (value: string) => `parent.${parentIndex}.${value}`;
                        const category = `Ouder ${parentNumber}`;
                        const enabled = false;

                        return [
                            new SelectableColumn({
                                id: getId('type'),
                                name: 'Type',
                                category,
                                enabled
                            }),
                            new SelectableColumn({
                                id: getId('firstName'),
                                name: 'Voornaam',
                                category,
                                enabled
                            }),
                            new SelectableColumn({
                                id: getId('lastName'),
                                name: 'Achternaam',
                                category,
                                enabled
                            }),
                            new SelectableColumn({
                                id: getId('phone'),
                                name: 'Telefoonnummer',
                                category,
                                enabled
                            }),
        
                            new SelectableColumn({
                                id: getId('email'),
                                name: 'E-mailadres',
                                category,
                                enabled
                            }),
                            new SelectableColumn({
                                id: getId('address'),
                                name: 'Adres',
                                category,
                                enabled
                            }),
                        ]
                    }),

                    new SelectableColumn({
                        id: 'unverifiedPhones',
                        name: 'Telefoonnummers',
                        category: 'Niet-geverifieerde gegevens',
                        enabled: false
                    }),

                    new SelectableColumn({
                        id: 'unverifiedEmails',
                        name: 'E-mailadressen',
                        category: 'Niet-geverifieerde gegevens',
                        enabled: false
                    }),

                    ...[1, 2].map((number, index) => {
                        return new SelectableColumn({
                            id:  `unverifiedAddresses.${index}`,
                            name: `Adres ${number}`,
                            category: 'Niet-geverifieerde gegevens',
                            enabled: false
                        })
                    }),

                    ...flattenedCategories.flatMap((category) => {
                        return category.getAllRecords().flatMap((record) => {
                            return new SelectableColumn({
                                id: `recordAnswers.${record.id}`,
                                name: record.name,
                                category: category.name,
                                description: record.description
                            })
                        })
                    })
                ]
            })
        ]
    })
}
