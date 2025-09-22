import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import { Platform, RecordCategory } from '@stamhoofd/structures';

export function getSelectableWorkbook(_platform: Platform) {
    const categories = _platform.config.organizationLevelRecordsConfiguration.recordCategories;
    const flattenedCategories = RecordCategory.flattenCategoriesWith(categories, r => r.excelColumns.length > 0);

    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'organizations',
                name: $t(`edfc89fe-a16e-4789-bda9-1529f8a97f7c`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`8daf57de-69cf-48fe-b09b-772c54473184`),
                        description: $t(`22b85aa5-dd0c-4c72-9cbc-823b309a42da`),
                        enabled: false,
                    }),

                    // todo: only if platform?
                    new SelectableColumn({
                        id: 'uri',
                        name: $t(`4c61c43e-ed3c-418e-8773-681d19323520`),
                        description: $t(`dd5625e0-2997-49b1-be73-21c30e42aafd`),
                    }),

                    new SelectableColumn({
                        id: 'name',
                        name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
                    }),

                    new SelectableColumn({
                        id: 'tags',
                        name: $t(`97e1963f-621e-4754-84b7-e874e2c96b04`),
                    }),

                    new SelectableColumn({
                        id: 'address',
                        name: $t(`f7e792ed-2265-41e9-845f-e3ce0bc5da7c`),
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
                name: $t(`fbfaabbf-95d2-49ae-900b-d7b2321907bb`),
                columns: [
                    new SelectableColumn({
                        id: 'organization.id',
                        name: $t(`8daf57de-69cf-48fe-b09b-772c54473184`),
                        description: $t(`22b85aa5-dd0c-4c72-9cbc-823b309a42da`),
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'organization.uri',
                        name: $t(`4c61c43e-ed3c-418e-8773-681d19323520`),
                        description: $t(`dd5625e0-2997-49b1-be73-21c30e42aafd`),
                    }),

                    new SelectableColumn({
                        id: 'organization.name',
                        name: $t(`6149c3a0-74ee-476d-835f-94a4ac59ba34`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.name',
                        name: $t(`1d5eaad1-78e1-4b1f-9d06-e72a529a8e65`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.firstName',
                        name: $t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.lastName',
                        name: $t(`171bd1df-ed4b-417f-8c5e-0546d948469a`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.email',
                        name: $t(`ccb47323-6aa7-4f37-a03c-848ed47eb412`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.address',
                        name: $t(`f7e792ed-2265-41e9-845f-e3ce0bc5da7c`),
                    }),
                ],
            }),
            new SelectableSheet({
                id: 'premises',
                name: $t(`eecb4cc5-f807-4325-8083-1fe893756ce4`),
                columns: [
                    new SelectableColumn({
                        id: 'organization.id',
                        name: $t(`8daf57de-69cf-48fe-b09b-772c54473184`),
                        description: $t(`22b85aa5-dd0c-4c72-9cbc-823b309a42da`),
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'organization.uri',
                        name: $t(`4c61c43e-ed3c-418e-8773-681d19323520`),
                        description: $t(`dd5625e0-2997-49b1-be73-21c30e42aafd`),
                    }),

                    new SelectableColumn({
                        id: 'organization.name',
                        name: $t(`6149c3a0-74ee-476d-835f-94a4ac59ba34`),
                    }),

                    new SelectableColumn({
                        id: 'premise.name',
                        name: $t(`179c8dd9-2719-41a9-ad5f-11aab6e4a1c3`),
                    }),

                    new SelectableColumn({
                        id: 'premise.type',
                        name: $t(`a3765fff-0634-4ffe-a726-005fd8ba5dcd`),
                    }),

                    new SelectableColumn({
                        id: 'premise.address',
                        name: $t(`f7e792ed-2265-41e9-845f-e3ce0bc5da7c`),
                    }),
                ],
            }),
        ],
    });
}
