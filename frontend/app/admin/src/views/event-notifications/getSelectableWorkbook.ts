import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import { Platform, RecordCategory } from '@stamhoofd/structures';

export function getSelectableWorkbook(platform: Platform) {
    const recordCategories = platform.config.eventNotificationTypes.flatMap(r => r.recordCategories);

    const flattenedCategories = RecordCategory.flattenCategoriesWith(recordCategories, r => r.excelColumns.length > 0);

    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'event-notifications',
                name: $t('Kampmeldingen'),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: 'ID',
                        description: $t('Unieke identificatie van de kampmelding'),
                    }),

                    new SelectableColumn({
                        id: 'name',
                        name: $t('Activiteitsnaam'),
                    }),

                    new SelectableColumn({
                        id: 'organization.name',
                        name: $t('Groepsnaam'),
                    }),

                    new SelectableColumn({
                        id: 'organization.uri',
                        name: $t('Groepsnummer'),
                    }),

                    new SelectableColumn({
                        id: 'status',
                        name: $t('Status'),
                    }),

                    new SelectableColumn({
                        id: 'feedbackText',
                        name: $t('Opmerkingen'),
                    }),

                    new SelectableColumn({
                        id: 'startDate',
                        name: $t('Startdatum'),
                    }),

                    new SelectableColumn({
                        id: 'endDate',
                        name: $t('Einddatum'),
                    }),

                    new SelectableColumn({
                        id: 'submittedAt',
                        category: 'Indiening',
                        name: $t('Datum'),
                    }),

                    new SelectableColumn({
                        id: 'submittedBy',
                        category: 'Indiening',
                        name: $t('Indiener'),
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
