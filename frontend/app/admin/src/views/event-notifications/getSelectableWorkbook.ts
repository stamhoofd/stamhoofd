import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import type { Platform} from '@stamhoofd/structures';
import { RecordCategory } from '@stamhoofd/structures';

export function getSelectableWorkbook(platform: Platform) {
    const recordCategories = platform.config.eventNotificationTypes.flatMap(r => r.recordCategories);

    const flattenedCategories = RecordCategory.flattenCategoriesWith(recordCategories, r => r.excelColumns.length > 0);

    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'event-notifications',
                name: $t('%CV'),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`%1P`),
                        description: $t('%CW'),
                    }),

                    new SelectableColumn({
                        id: 'name',
                        name: $t('%B9'),
                    }),

                    new SelectableColumn({
                        id: 'organization.name',
                        name: $t('%CX'),
                    }),

                    new SelectableColumn({
                        id: 'organization.uri',
                        name: $t('%1O1'),
                    }),

                    new SelectableColumn({
                        id: 'status',
                        name: $t('%1A'),
                    }),

                    new SelectableColumn({
                        id: 'feedbackText',
                        name: $t('%YT'),
                    }),

                    new SelectableColumn({
                        id: 'startDate',
                        name: $t('%1Of'),
                    }),

                    new SelectableColumn({
                        id: 'endDate',
                        name: $t('%1P8'),
                    }),

                    new SelectableColumn({
                        id: 'submittedAt',
                        category: $t(`%Gd`),
                        name: $t('%7R'),
                    }),

                    new SelectableColumn({
                        id: 'submittedBy',
                        category: $t(`%Gd`),
                        name: $t('%CY'),
                    }),

                    ...flattenedCategories.flatMap((category) => {
                        return category.getAllRecords().flatMap((record) => {
                            return new SelectableColumn({
                                id: `recordAnswers.${record.id}`,
                                name: record.name.toString(),
                                category: category.name.toString(),
                                description: record.description.toString(),
                            });
                        });
                    }),
                ],
            }),
        ],
    });
}
