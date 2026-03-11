import { SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export';
import { BalanceItemRelationType, BalanceItemType, getBalanceItemRelationTypeDescription, getBalanceItemRelationTypeName, getBalanceItemTypeName } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

/**
 * Todo: in the future when we need to read injects to update the available columns
 * -> a hook is better suited for this
 */
export function useSelectableWorkbook() {
    return {
        getSelectableWorkbook: () => getSelectableWorkbook(),
    };
}

export function getSelectableWorkbook() {
    return new SelectableWorkbook({
        sheets: [
            new SelectableSheet({
                id: 'balanceItems',
                name: $t(`%1LA`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`%1LS`),
                        description: $t(`%1LT`),
                    }),

                    new SelectableColumn({
                        id: 'type',
                        name: $t(`%1B`),
                        description: Formatter.joinLast(Object.values(BalanceItemType).map(type => getBalanceItemTypeName(type)), ', ', ' ' + $t(`%M1`) + ' '),
                    }),

                    new SelectableColumn({
                        id: 'category',
                        name: $t(`%M2`),
                        description: $t(`%M3`),
                    }),

                    new SelectableColumn({
                        id: 'description',
                        name: $t(`%6o`),
                    }),

                    new SelectableColumn({
                        id: 'createdAt',
                        name: $t(`%wV`),
                    }),

                    new SelectableColumn({
                        id: 'dueAt',
                        name: $t(`%wW`),
                    }),

                    ...Object.values(BalanceItemRelationType).map(relationType => new SelectableColumn({
                        id: `relations.${relationType}`,
                        name: getBalanceItemRelationTypeName(relationType),
                        description: getBalanceItemRelationTypeDescription(relationType),
                    })),

                    new SelectableColumn({
                        id: 'quantity',
                        name: $t(`%M4`),
                    }),

                    new SelectableColumn({
                        id: 'unitPrice',
                        name: $t(`%6q`),
                    }),

                    new SelectableColumn({
                        id: 'payablePriceWithVAT',
                        name: $t(`%1IP`),
                    }),

                    new SelectableColumn({
                        id: 'priceOpen',
                        name: $t(`%1LU`, { date: Formatter.date(new Date(), true) }),
                    }),

                    new SelectableColumn({
                        id: 'pricePaid',
                        name: $t(`%1LV`, { date: Formatter.date(new Date(), true) }),
                    }),

                    new SelectableColumn({
                        id: 'pricePending',
                        name: $t(`%1LW`, { date: Formatter.date(new Date(), true) }),
                    }),

                    ...[Formatter.year(new Date()) - 2, Formatter.year(new Date()) - 1, Formatter.year(new Date())].map(year => new SelectableColumn({
                        id: `paidIn[${year}]`,
                        name: $t('%1L8', { year: year.toFixed(0) }),
                        enabled: false,
                    })),

                    ...[Formatter.year(new Date()) - 2, Formatter.year(new Date()) - 1, Formatter.year(new Date())].map(year => new SelectableColumn({
                        id: `chargedIn[${year}]`,
                        name: $t('%1L9', { year: year.toFixed(0) }),
                        description: $t('%1LR'),
                        enabled: false,
                    })),
                ],
            }),
        ],
    });
}
