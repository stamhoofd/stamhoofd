import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import { ContextPermissions } from '@stamhoofd/networking';
import { Group, Organization, Platform } from '@stamhoofd/structures';
import { getSelectableColumns as getSelectableColumnsForMembers } from '../../members/classes/getSelectableWorkbook';

export function getSelectableWorkbook(platform: Platform, organization: Organization | null, groups: Group[] = [], auth: ContextPermissions) {
    const groupColumns: SelectableColumn[] = [];

    for (const group of groups) {
        for (const menu of group.settings.optionMenus) {
            groupColumns.push(
                new SelectableColumn({
                    id: `optionMenu.${menu.id}`,
                    name: menu.name,
                    category: group.settings.name.toString(),
                }),
            );

            for (const option of menu.options) {
                if (option.allowAmount) {
                    groupColumns.push(
                        new SelectableColumn({
                            id: `optionMenu.${menu.id}.${option.id}.amount`,
                            name: menu.name + ' → ' + option.name + ' → ' + $t('ed55e67d-1dce-46b2-8250-948c7cd616c2'),
                            category: group.settings.name.toString(),
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
                        id: `recordAnswers.${record.id}`,
                        name: recordCategory.name + ' → ' + record.name,
                        category: group.settings.name.toString(),
                    }),
                );
            }
        }
    }

    const memberColumns = getSelectableColumnsForMembers({ platform, organization, auth });

    const columns: (SelectableColumn | null) [] = [
        new SelectableColumn({
            id: 'id',
            name: $t(`8daf57de-69cf-48fe-b09b-772c54473184`),
            description: $t('Unieke identificatie van de inschrijving'),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'price',
            name: $t(`ae21b9bf-7441-4f38-b789-58f34612b7af`),
        }),
        ...groupColumns,
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
