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
                ],
            }),
        ],
    });
}
