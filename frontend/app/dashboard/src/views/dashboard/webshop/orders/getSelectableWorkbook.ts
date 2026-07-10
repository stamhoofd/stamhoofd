import { SelectableColumn } from '@stamhoofd/frontend-excel-export/SelectableColumn';
import { SelectableSheet } from '@stamhoofd/frontend-excel-export/SelectableSheet';
import { SelectableWorkbook } from '@stamhoofd/frontend-excel-export/SelectableWorkbook';

/**
 *
 * TODO:
 * - support sorting columns in backend (else this will throw)
 */

export function getSelectableWorkbook() {
    const columns: (SelectableColumn) [] = [
        new SelectableColumn({
            id: 'id',
            name: $t('ID bestelling'),
            description: $t(`Unieke identificatie van de bestelling`),
            enabled: false,
        })];

    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'orders',
                name: $t(`Bestellingen`),
                columns,
            }),
        ],
    });
}
