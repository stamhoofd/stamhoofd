import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import { ContextPermissions } from '@stamhoofd/networking';
import { Organization, Platform } from '@stamhoofd/structures';
import { getSelectableColumns as getSelectableColumnsForMembers } from '../../members/classes/getSelectableWorkbook';

export function getSelectableWorkbook(platform: Platform, organization: Organization | null, auth: ContextPermissions) {
    const memberColumns = getSelectableColumnsForMembers({ platform, organization, auth });

    const columns: (SelectableColumn | null) [] = [
        new SelectableColumn({
            id: 'id',
            name: $t(`8daf57de-69cf-48fe-b09b-772c54473184`),
            description: $t('Unieke identificatie van de inschrijving'),
            enabled: false,
        }),
        // todo: groups. should not be included?
        ...memberColumns.map((column) => {
            return new SelectableColumn({
                ...column,
                id: 'member.' + column.id,
            });
        }),
    ];

    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'registrations',
                name: $t(`97dc1e85-339a-4153-9413-cca69959d731`),
                columns: columns.filter(column => column !== null),
            }),
        ],
    });
}
