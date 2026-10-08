import { SelectableColumn } from '@stamhoofd/frontend-excel-export/SelectableColumn';
import { SelectableSheet } from '@stamhoofd/frontend-excel-export/SelectableSheet';
import { SelectableWorkbook } from '@stamhoofd/frontend-excel-export/SelectableWorkbook';

export function getSelectableWorkbook() {
    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'discountCodes',
                name: $t('Kortingscodes'),
                description: $t('Eén rij per kortingscode. Dit bestand kan je later opnieuw importeren.'),
                columns: [
                    new SelectableColumn({
                        id: 'code',
                        name: $t('Code'),
                    }),
                    new SelectableColumn({
                        id: 'email',
                        name: $t('E-mailadres'),
                    }),
                    new SelectableColumn({
                        id: 'description',
                        name: $t('Omschrijving'),
                    }),
                    new SelectableColumn({
                        id: 'maximumUsage',
                        name: $t('Maximum aantal keer gebruikt'),
                        description: $t('Leeg betekent onbeperkt.'),
                    }),
                ],
            }),
        ],
    });
}
