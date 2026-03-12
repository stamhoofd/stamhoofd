import { useFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
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
                name: $t(`%99`),
                description: $t(`%Mf`),
                columns: [
                    ...getGeneralColumns($t, $feature),
                    new SelectableColumn({
                        id: 'amountOpen',
                        name: $t(`%76`),
                    }),
                    new SelectableColumn({
                        id: 'amountPending',
                        name: $t(`%wc`),
                    }),
                ],
            }),
            new SelectableSheet({
                id: 'balanceItems',
                name: $t(`%Mg`),
                description: $t(`%Mh`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`%1P`),
                        description: $t(`%Mi`),
                    }),

                    ...getGeneralColumns($t, $feature, { category: $t(`%Mj`) }).map((c) => {
                        c.id = `receivableBalance.${c.id}`;
                        return c;
                    }),

                    new SelectableColumn({
                        id: 'type',
                        name: $t(`%1B`),
                        description: Formatter.joinLast(Object.values(BalanceItemType).map(type => getBalanceItemTypeName(type)), ', ', ' ' + $t(`%M1`) + ' '),
                    }),

                    new SelectableColumn({
                        id: 'category',
                        name: $t(`%M2`),
                        description: $t(`%Mk`),
                    }),

                    new SelectableColumn({
                        id: 'description',
                        name: $t(`%6o`),
                    }),

                    ...Object.values(BalanceItemRelationType).map(relationType => new SelectableColumn({
                        id: `relations.${relationType}`,
                        name: getBalanceItemRelationTypeName(relationType),
                        description: getBalanceItemRelationTypeDescription(relationType),
                    })),

                    new SelectableColumn({
                        id: 'amount',
                        name: $t(`%M4`),
                    }),

                    new SelectableColumn({
                        id: 'unitPrice',
                        name: $t(`%6q`),
                    }),

                    new SelectableColumn({
                        id: 'price',
                        name: $t(`%1IP`),
                    }),

                    new SelectableColumn({
                        id: 'pricePaid',
                        name: $t(`%Ml`),
                    }),

                    new SelectableColumn({
                        id: 'pricePending',
                        name: $t(`%wc`),
                    }),

                    new SelectableColumn({
                        id: 'priceOpen',
                        name: $t(`%76`),
                    }),

                    new SelectableColumn({
                        id: 'createdAt',
                        name: $t(`%1JJ`),
                    }),

                    new SelectableColumn({
                        id: 'dueAt',
                        name: $t(`%wW`),
                    }),

                    new SelectableColumn({
                        id: 'status',
                        name: $t(`%1A`),
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
                name: $t(`%wd`),
                description: $t(`%Mm`),
            }),
            new SelectableColumn({
                id: 'name',
                name: $t(`%Mn`),
                ...options,
            }),
            ...($feature('organization-receivable-balances')
                ? [
                        new SelectableColumn({
                            id: 'uri',
                            name: $t('%7C'),
                            ...options,
                        }),
                    ]
                : []),
            new SelectableColumn({
                id: 'objectType',
                name: $t(`%Mo`),
                ...options,
            }),
        ];
    }
}
