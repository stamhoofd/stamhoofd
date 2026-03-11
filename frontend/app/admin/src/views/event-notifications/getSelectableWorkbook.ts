import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import { Platform, RecordCategory } from '@stamhoofd/structures';

export function getSelectableWorkbook(platform: Platform) {
    const recordCategories = platform.config.eventNotificationTypes.flatMap(r => r.recordCategories);

    const flattenedCategories = RecordCategory.flattenCategoriesWith(recordCategories, r => r.excelColumns.length > 0);

    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'event-notifications',
                name: $t('000be3fe-9354-4c2c-baf1-d0cd4d079830'),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`8daf57de-69cf-48fe-b09b-772c54473184`),
                        description: $t('5239cde1-c980-43eb-b6f1-83f6bcd0652d'),
                    }),

                    new SelectableColumn({
                        id: 'name',
                        name: $t('a7db7ad2-4106-4cf0-a8fc-1e68b0a5bf24'),
                    }),

                    new SelectableColumn({
                        id: 'organization.name',
                        name: $t('3eefa3b1-525b-464b-adef-e3b9efd9257f'),
                    }),

                    new SelectableColumn({
                        id: 'organization.uri',
                        name: $t('05723781-9357-41b2-9fb8-cb4f80dde7f9'),
                    }),

                    new SelectableColumn({
                        id: 'status',
                        name: $t('6b4b9fb3-ca24-43cd-9f7b-a5f597b943d8'),
                    }),

                    new SelectableColumn({
                        id: 'feedbackText',
                        name: $t('12b2ce84-6297-49a2-a9c4-d5619b764313'),
                    }),

                    new SelectableColumn({
                        id: 'startDate',
                        name: $t('300d2935-b578-48cc-b58e-1c0446a68d59'),
                    }),

                    new SelectableColumn({
                        id: 'endDate',
                        name: $t('3c90169c-9776-4d40-bda0-dba27a5bad69'),
                    }),

                    new SelectableColumn({
                        id: 'submittedAt',
                        category: $t(`70de758a-58c5-45ce-8cbd-6a984069cd1b`),
                        name: $t('112b7686-dffc-4ae9-9706-e3efcd34898f'),
                    }),

                    new SelectableColumn({
                        id: 'submittedBy',
                        category: $t(`70de758a-58c5-45ce-8cbd-6a984069cd1b`),
                        name: $t('27301eda-b7f6-44c3-baed-25e8f416d777'),
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
