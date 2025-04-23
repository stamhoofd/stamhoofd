import { useFeatureFlag } from '@stamhoofd/components';
import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { BalanceItemRelationType, BalanceItemType, getBalanceItemRelationTypeDescription, getBalanceItemRelationTypeName, getBalanceItemTypeName } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

/**
 * Todo: in the future when we need to read injects to update the available columns
 * -> a hook is better suited for this
 */
export function useSelectableWorkbook() {
    const $t = useTranslate();
    const $feature = useFeatureFlag();

    return {
        getSelectableWorkbook: () => getSelectableWorkbook($t, $feature),
    };
}

export function getSelectableWorkbook($t: ReturnType<typeof useTranslate>, $feature: ReturnType<typeof useFeatureFlag>) {
    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'receivableBalances',
                name: $t(`3df2215e-5c13-493d-afc6-4a866150960c`),
                description: $t(`6025e62d-b832-47dc-93e8-ad7d5753069f`),
                columns: [
                    ...getGeneralColumns($t, $feature),
                    new SelectableColumn({
                        id: 'amountOpen',
                        name: $t(`40d7ac9f-f62d-4a9d-8b2f-5fcfb938c12f`),
                    }),
                    new SelectableColumn({
                        id: 'amountPending',
                        name: $t(`ac279f6b-0c7c-4ef1-9178-1fd030fe7cc8`),
                    }),
                ],
            }),
            new SelectableSheet({
                id: 'balanceItems',
                name: $t(`0d735b43-02e4-4846-8aea-a603bdc9f7a4`),
                description: $t(`8e74fdaf-ed55-443c-b909-e0f53b02530b`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`8daf57de-69cf-48fe-b09b-772c54473184`),
                        description: $t(`15bb965e-b592-4954-a40e-3cbe5786e591`),
                    }),

                    ...getGeneralColumns($t, $feature, { category: $t(`d13bace8-4a8d-4fb0-9656-92260f46a194`) }).map((c) => {
                        c.id = `receivableBalance.${c.id}`;
                        return c;
                    }),

                    new SelectableColumn({
                        id: 'type',
                        name: $t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`),
                        description: Formatter.joinLast(Object.values(BalanceItemType).map(type => getBalanceItemTypeName(type)), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' '),
                    }),

                    new SelectableColumn({
                        id: 'category',
                        name: $t(`502dc65d-e8d3-4b20-a478-a76ca9084e60`),
                        description: $t(`15e35271-f215-427c-9cef-23c04faf9337`),
                    }),

                    new SelectableColumn({
                        id: 'description',
                        name: $t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`),
                    }),

                    ...Object.values(BalanceItemRelationType).map(relationType => new SelectableColumn({
                        id: `relations.${relationType}`,
                        name: getBalanceItemRelationTypeName(relationType),
                        description: getBalanceItemRelationTypeDescription(relationType),
                    })),

                    new SelectableColumn({
                        id: 'amount',
                        name: $t(`697df3e7-fbbf-421d-81c2-9c904dce4842`),
                    }),

                    new SelectableColumn({
                        id: 'unitPrice',
                        name: $t(`bab8d047-63db-4d0f-82c7-3a8d69a85745`),
                    }),

                    new SelectableColumn({
                        id: 'price',
                        name: $t(`52bff8d2-52af-4d3f-b092-96bcfa4c0d03`),
                    }),

                    new SelectableColumn({
                        id: 'pricePaid',
                        name: $t(`25c803f0-6b45-42aa-9b88-573e3706b8bb`),
                    }),

                    new SelectableColumn({
                        id: 'pricePending',
                        name: $t(`ac279f6b-0c7c-4ef1-9178-1fd030fe7cc8`),
                    }),

                    new SelectableColumn({
                        id: 'priceOpen',
                        name: $t(`40d7ac9f-f62d-4a9d-8b2f-5fcfb938c12f`),
                    }),

                    new SelectableColumn({
                        id: 'createdAt',
                        name: $t(`b6391640-1e01-47f9-913d-360fb0903b75`),
                    }),

                    new SelectableColumn({
                        id: 'dueAt',
                        name: $t(`eae99aeb-eb79-4a91-8e84-5364cbc74364`),
                    }),

                    new SelectableColumn({
                        id: 'status',
                        name: $t(`e4b54218-b4ff-4c29-a29e-8bf9a9aef0c5`),
                    }),
                ],
            }),
        ],
    });
}

function getGeneralColumns($t: ReturnType<typeof useTranslate>, $feature: ReturnType<typeof useFeatureFlag>, options?: { category?: string | null }) {
    {
        return [
            new SelectableColumn({
                id: 'id',
                name: $t(`83b38b3f-6b5d-4c70-9d37-821b80003432`),
                description: $t(`d1ccda9a-6579-4fa6-8f6c-b29997ef8d5d`),
            }),
            new SelectableColumn({
                id: 'name',
                name: $t(`72b10926-c8b2-4e8b-8527-43d8286dd9e1`),
                ...options,
            }),
            ...($feature('organization-receivable-balances')
                ? [
                        new SelectableColumn({
                            id: 'uri',
                            name: $t('cd798189-d5c8-4b79-98f7-a68786ab288c'),
                            ...options,
                        }),
                    ]
                : []),
            new SelectableColumn({
                id: 'objectType',
                name: $t(`203d72ce-fa32-46a5-b219-7ba76192d99a`),
                ...options,
            }),
        ];
    }
}
