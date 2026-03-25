import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import type { Platform} from '@stamhoofd/structures';
import { RecordCategory } from '@stamhoofd/structures';

export function getSelectableWorkbook(_platform: Platform) {
    const categories = _platform.config.organizationLevelRecordsConfiguration.recordCategories;
    const flattenedCategories = RecordCategory.flattenCategoriesWith(categories, r => r.excelColumns.length > 0);

    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'organizations',
                name: $t(`%wP`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`%1P`),
                        description: $t(`%H0`),
                        enabled: false,
                    }),

                    // todo: only if platform?
                    new SelectableColumn({
                        id: 'uri',
                        name: $t(`%7C`),
                        description: $t(`%H1`),
                    }),

                    new SelectableColumn({
                        id: 'name',
                        name: $t(`%Gq`),
                    }),

                    new SelectableColumn({
                        id: 'tags',
                        name: $t(`%3G`),
                    }),

                    new SelectableColumn({
                        id: 'address',
                        name: $t(`%Cn`),
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

            new SelectableSheet({
                id: 'responsibilities',
                name: $t(`%7D`),
                columns: [
                    new SelectableColumn({
                        id: 'organization.id',
                        name: $t(`%1P`),
                        description: $t(`%H0`),
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'organization.uri',
                        name: $t(`%7C`),
                        description: $t(`%H1`),
                    }),

                    new SelectableColumn({
                        id: 'organization.name',
                        name: $t(`%CX`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.name',
                        name: $t(`%H2`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.firstName',
                        name: $t(`%1MT`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.lastName',
                        name: $t(`%1MU`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.email',
                        name: $t(`%2e`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.address',
                        name: $t(`%Cn`),
                    }),
                ],
            }),
            new SelectableSheet({
                id: 'premises',
                name: $t(`%6c`),
                columns: [
                    new SelectableColumn({
                        id: 'organization.id',
                        name: $t(`%1P`),
                        description: $t(`%H0`),
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'organization.uri',
                        name: $t(`%7C`),
                        description: $t(`%H1`),
                    }),

                    new SelectableColumn({
                        id: 'organization.name',
                        name: $t(`%CX`),
                    }),

                    new SelectableColumn({
                        id: 'premise.name',
                        name: $t(`%H3`),
                    }),

                    new SelectableColumn({
                        id: 'premise.type',
                        name: $t(`%1i`),
                    }),

                    new SelectableColumn({
                        id: 'premise.address',
                        name: $t(`%Cn`),
                    }),
                ],
            }),
        ],
    });
}
