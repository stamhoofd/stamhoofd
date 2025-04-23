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
                        name: $t(`ID`),
                        description: $t('5239cde1-c980-43eb-b6f1-83f6bcd0652d'),
                    }),

                    new SelectableColumn({
                        id: 'name',
                        name: $t('ab4f65c9-8acb-4e7d-a40c-78afe71a489d'),
                    }),

                    new SelectableColumn({
                        id: 'organization.name',
                        name: $t('3eefa3b1-525b-464b-adef-e3b9efd9257f'),
                    }),

                    new SelectableColumn({
                        id: 'organization.uri',
                        name: $t('eae11d90-befa-4482-9fe3-412cba791ef5'),
                    }),

                    new SelectableColumn({
                        id: 'status',
                        name: $t('6b4b9fb3-ca24-43cd-9f7b-a5f597b943d8'),
                    }),

                    new SelectableColumn({
                        id: 'feedbackText',
                        name: $t('387f4352-c78d-4e21-9dfe-a2433e3ba554'),
                    }),

                    new SelectableColumn({
                        id: 'startDate',
                        name: $t('f36ea1e0-7bf6-4e15-b921-cd50ec889e33'),
                    }),

                    new SelectableColumn({
                        id: 'endDate',
                        name: $t('43deefc6-dd11-4d2c-bf95-2c20150a246f'),
                    }),

                    new SelectableColumn({
                        id: 'submittedAt',
                        category: $t(`Indiening`),
                        name: $t('65110237-a12e-4cbd-8514-75a942626d7a'),
                    }),

                    new SelectableColumn({
                        id: 'submittedBy',
                        category: $t(`Indiening`),
                        name: $t('27301eda-b7f6-44c3-baed-25e8f416d777'),
                    }),

                    ...flattenedCategories.flatMap((category) => {
                        return category.getAllRecords().flatMap((record) => {
                            return new SelectableColumn({
                                id: `recordAnswers.${record.id}`,
                                name: record.name,
                                category: category.name,
                                description: record.description,
                            });
                        });
                    }),
                ],
            }),
        ],
    });
}
