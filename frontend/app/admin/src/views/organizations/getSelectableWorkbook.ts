import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import { Platform, RecordCategory } from '@stamhoofd/structures';

export function getSelectableWorkbook(_platform: Platform) {
    const categories = _platform.config.organizationLevelRecordsConfiguration.recordCategories;
    const flattenedCategories = RecordCategory.flattenCategoriesWith(categories, r => r.excelColumns.length > 0);

    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'organizations',
                name: $t(`2a033cd8-b9e4-4a92-a8a6-b4a687d87e79`),
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
                        name: $t(`05723781-9357-41b2-9fb8-cb4f80dde7f9`),
                        description: $t(`dd5625e0-2997-49b1-be73-21c30e42aafd`),
                    }),

                    new SelectableColumn({
                        id: 'name',
                        name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
                    }),

                    new SelectableColumn({
                        id: 'tags',
                        name: $t(`0be39baa-0b8e-47a5-bd53-0feeb14a0f93`),
                    }),

                    new SelectableColumn({
                        id: 'address',
                        name: $t(`0a37de09-120b-4bea-8d13-6d7ed6823884`),
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
                name: $t(`b0cb950d-856f-4068-bf2f-9636927020f4`),
                columns: [
                    new SelectableColumn({
                        id: 'organization.id',
                        name: $t(`8daf57de-69cf-48fe-b09b-772c54473184`),
                        description: $t(`22b85aa5-dd0c-4c72-9cbc-823b309a42da`),
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'organization.uri',
                        name: $t(`05723781-9357-41b2-9fb8-cb4f80dde7f9`),
                        description: $t(`dd5625e0-2997-49b1-be73-21c30e42aafd`),
                    }),

                    new SelectableColumn({
                        id: 'organization.name',
                        name: $t(`3eefa3b1-525b-464b-adef-e3b9efd9257f`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.name',
                        name: $t(`1d5eaad1-78e1-4b1f-9d06-e72a529a8e65`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.firstName',
                        name: $t(`603606c2-95ca-4967-814c-53ec3297bf33`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.lastName',
                        name: $t(`033780e9-417d-4f0a-9aba-7ddfdf655d22`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.email',
                        name: $t(`ccb47323-6aa7-4f37-a03c-848ed47eb412`),
                    }),

                    new SelectableColumn({
                        id: 'responsibility.member.address',
                        name: $t(`0a37de09-120b-4bea-8d13-6d7ed6823884`),
                    }),
                ],
            }),
            new SelectableSheet({
                id: 'premises',
                name: $t(`7f531562-9609-456e-a8c3-2b373cad3f29`),
                columns: [
                    new SelectableColumn({
                        id: 'organization.id',
                        name: $t(`8daf57de-69cf-48fe-b09b-772c54473184`),
                        description: $t(`22b85aa5-dd0c-4c72-9cbc-823b309a42da`),
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'organization.uri',
                        name: $t(`05723781-9357-41b2-9fb8-cb4f80dde7f9`),
                        description: $t(`dd5625e0-2997-49b1-be73-21c30e42aafd`),
                    }),

                    new SelectableColumn({
                        id: 'organization.name',
                        name: $t(`3eefa3b1-525b-464b-adef-e3b9efd9257f`),
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
                        name: $t(`0a37de09-120b-4bea-8d13-6d7ed6823884`),
                    }),
                ],
            }),
        ],
    });
}
