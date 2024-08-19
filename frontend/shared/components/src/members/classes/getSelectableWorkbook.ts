import { SelectableColumn, SelectableSheet, SelectableWorkbook } from "@stamhoofd/frontend-excel-export";
import { Organization, Platform, RecordCategory } from "@stamhoofd/structures";

export function getSelectableWorkbook(platform: Platform, organization: Organization | null) {
    const recordCategories = [
        ...(organization?.meta.recordsConfiguration.recordCategories ?? []),
        ...platform.config.recordsConfiguration.recordCategories
    ]

    const flattenedCategories = RecordCategory.flattenCategoriesWith(recordCategories, (r) => r.excelColumns.length > 0)

    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'members',
                name: 'Leden',
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: 'ID',
                        description: 'Unieke identificatie van het lid',
                    }),

                    new SelectableColumn({
                        id: 'firstName',
                        name: 'Voornaam'
                    }),

                    new SelectableColumn({
                        id: 'lastName',
                        name: 'Achternaam'
                    }),

                    new SelectableColumn({
                        id: 'birthDay',
                        name: 'Geboortedatum'
                    }),

                    ...flattenedCategories.flatMap((category) => {
                        return category.getAllRecords().flatMap((record) => {
                            return new SelectableColumn({
                                id: `recordAnswers.${record.id}`,
                                name: record.name,
                                category: category.name,
                                description: record.description
                            })
                        })
                    })
                ]
            })
        ]
    })
}
