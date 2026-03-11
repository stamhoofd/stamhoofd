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
                name: $t(`231f28d7-292a-43bc-877b-751012b6ae48`),
                description: $t(`6025e62d-b832-47dc-93e8-ad7d5753069f`),
                columns: [
                    ...getGeneralColumns($t, $feature),
                    new SelectableColumn({
                        id: 'amountOpen',
                        name: $t(`28c2bc66-231f-44f3-9249-c1981b871a1f`),
                    }),
                    new SelectableColumn({
                        id: 'amountPending',
                        name: $t(`5c75e9bf-1b64-4d28-a435-6e33247d5170`),
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
                        name: $t(`11d6f2fc-c72d-4c18-aa6d-b8118c2aaa5c`),
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
                        name: $t(`7453643b-fdb2-4aa1-9964-ddd71762c983`),
                    }),

                    new SelectableColumn({
                        id: 'price',
                        name: $t(`1205deb9-498d-435d-a6e1-91ea98371523`),
                    }),

                    new SelectableColumn({
                        id: 'pricePaid',
                        name: $t(`25c803f0-6b45-42aa-9b88-573e3706b8bb`),
                    }),

                    new SelectableColumn({
                        id: 'pricePending',
                        name: $t(`5c75e9bf-1b64-4d28-a435-6e33247d5170`),
                    }),

                    new SelectableColumn({
                        id: 'priceOpen',
                        name: $t(`28c2bc66-231f-44f3-9249-c1981b871a1f`),
                    }),

                    new SelectableColumn({
                        id: 'createdAt',
                        name: $t(`10fd24bb-43dd-4174-9a23-db3ac54af9be`),
                    }),

                    new SelectableColumn({
                        id: 'dueAt',
                        name: $t(`3d586760-01f3-42c3-82be-44cea7ad0820`),
                    }),

                    new SelectableColumn({
                        id: 'status',
                        name: $t(`6b4b9fb3-ca24-43cd-9f7b-a5f597b943d8`),
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
                name: $t(`333e8879-0e98-4233-bc51-93a5c623c75e`),
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
                            name: $t('05723781-9357-41b2-9fb8-cb4f80dde7f9'),
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
