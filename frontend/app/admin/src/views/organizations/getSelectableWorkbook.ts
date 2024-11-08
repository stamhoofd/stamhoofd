import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import { Platform } from '@stamhoofd/structures';

export function getSelectableWorkbook(_platform: Platform) {
    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'organizations',
                name: 'Groepen',
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: 'ID',
                        description: 'Unieke identificatie van de groep',
                        enabled: false,
                    }),

                    // todo: only if platform?
                    new SelectableColumn({
                        id: 'uri',
                        name: 'Groepsnummer',
                        description: 'Nummer van de groep',
                    }),

                    new SelectableColumn({
                        id: 'name',
                        name: 'Naam',
                    }),

                    new SelectableColumn({
                        id: 'tags',
                        name: 'Hiërarchie',
                    }),

                    new SelectableColumn({
                        id: 'address',
                        name: 'Adres',
                    }),
                ],
            }),

            new SelectableSheet({
                id: 'responsibilities',
                name: 'Functies',
                columns: [
                    new SelectableColumn({
                        id: 'organization.id',
                        name: 'ID',
                        description: 'Unieke identificatie van de groep',
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'organization.uri',
                        name: 'Groepsnummer',
                        description: 'Nummer van de groep',
                    }),

                    new SelectableColumn({
                        id: 'organization.name',
                        name: 'Groepsnaam',
                    }),

                    new SelectableColumn({
                        id: 'responsibility.name',
                        name: 'Functie',
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.firstName',
                        name: 'Voornaam',
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.lastName',
                        name: 'Achternaam',
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.email',
                        name: 'E-mail',
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.address',
                        name: 'Adres',
                    }),
                ],
            }),
            new SelectableSheet({
                id: 'premises',
                name: 'Lokalen',
                columns: [
                    new SelectableColumn({
                        id: 'organization.id',
                        name: 'ID',
                        description: 'Unieke identificatie van de groep',
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'organization.uri',
                        name: 'Groepsnummer',
                        description: 'Nummer van de groep',
                    }),

                    new SelectableColumn({
                        id: 'organization.name',
                        name: 'Groepsnaam',
                    }),

                    new SelectableColumn({
                        id: 'premise.name',
                        name: 'Naam gebouw',
                    }),

                    new SelectableColumn({
                        id: 'premise.type',
                        name: 'Types',
                    }),

                    new SelectableColumn({
                        id: 'premise.address',
                        name: 'Adres',
                    }),
                ],
            }),
        ],
    });
}
