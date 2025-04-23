import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import { Platform } from '@stamhoofd/structures';

export function getSelectableWorkbook(_platform: Platform) {
    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'organizations',
                name: $t(`Groepen`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`ID`),
                        description: $t(`Unieke identificatie van de groep`),
                        enabled: false,
                    }),

                    // todo: only if platform?
                    new SelectableColumn({
                        id: 'uri',
                        name: $t(`Groepsnummer`),
                        description: $t(`Nummer van de groep`),
                    }),

                    new SelectableColumn({
                        id: 'name',
                        name: $t(`Naam`),
                    }),

                    new SelectableColumn({
                        id: 'tags',
                        name: $t(`Hiërarchie`),
                    }),

                    new SelectableColumn({
                        id: 'address',
                        name: $t(`Adres`),
                    }),
                ],
            }),

            new SelectableSheet({
                id: 'responsibilities',
                name: $t(`Functies`),
                columns: [
                    new SelectableColumn({
                        id: 'organization.id',
                        name: $t(`ID`),
                        description: $t(`Unieke identificatie van de groep`),
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'organization.uri',
                        name: $t(`Groepsnummer`),
                        description: $t(`Nummer van de groep`),
                    }),

                    new SelectableColumn({
                        id: 'organization.name',
                        name: $t(`Groepsnaam`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.name',
                        name: $t(`Functie`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.firstName',
                        name: $t(`Voornaam`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.lastName',
                        name: $t(`Achternaam`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.email',
                        name: $t(`E-mail`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.address',
                        name: $t(`Adres`),
                    }),
                ],
            }),
            new SelectableSheet({
                id: 'premises',
                name: $t(`Lokalen`),
                columns: [
                    new SelectableColumn({
                        id: 'organization.id',
                        name: $t(`ID`),
                        description: $t(`Unieke identificatie van de groep`),
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'organization.uri',
                        name: $t(`Groepsnummer`),
                        description: $t(`Nummer van de groep`),
                    }),

                    new SelectableColumn({
                        id: 'organization.name',
                        name: $t(`Groepsnaam`),
                    }),

                    new SelectableColumn({
                        id: 'premise.name',
                        name: $t(`Naam gebouw`),
                    }),

                    new SelectableColumn({
                        id: 'premise.type',
                        name: $t(`Types`),
                    }),

                    new SelectableColumn({
                        id: 'premise.address',
                        name: $t(`Adres`),
                    }),
                ],
            }),
        ],
    });
}
