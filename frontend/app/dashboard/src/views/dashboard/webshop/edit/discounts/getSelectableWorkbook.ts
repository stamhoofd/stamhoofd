import { SelectableColumn } from '@stamhoofd/frontend-excel-export/SelectableColumn';
import { SelectableSheet } from '@stamhoofd/frontend-excel-export/SelectableSheet';
import { SelectableWorkbook } from '@stamhoofd/frontend-excel-export/SelectableWorkbook';

export function getSelectableWorkbook() {
    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'discountCodes',
                name: $t('%QM'),
                description: $t('%Zvm'),
                columns: [
                    new SelectableColumn({
                        id: 'code',
                        name: $t('%1eg'),
                    }),
                    new SelectableColumn({
                        id: 'email',
                        name: $t('%1FK'),
                    }),
                    new SelectableColumn({
                        id: 'description',
                        name: $t('%6o'),
                    }),
                    new SelectableColumn({
                        id: 'maximumUsage',
                        name: $t('%Zwq'),
                        description: $t('%ZxJ'),
                    }),
                ],
            }),
        ],
    });
}
