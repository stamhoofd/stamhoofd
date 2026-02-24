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
                name: $t(`Aanrekeningen`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`ID`),
                        description: $t(`Unieke identificatie van de aanrekening`),
                    }),

                    new SelectableColumn({
                        id: 'type',
                        name: $t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`),
                        description: Formatter.joinLast(Object.values(BalanceItemType).map(type => getBalanceItemTypeName(type)), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' '),
                    }),

                    new SelectableColumn({
                        id: 'category',
                        name: $t(`502dc65d-e8d3-4b20-a478-a76ca9084e60`),
                        description: $t(`9bedb14f-45cf-4cf8-b0ca-7e3e96485d95`),
                    }),

                    new SelectableColumn({
                        id: 'description',
                        name: $t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`),
                    }),

                    new SelectableColumn({
                        id: 'createdAt',
                        name: $t(`a6eb80ee-4da2-4b74-ad1b-cd3af3fe5fca`),
                    }),

                    new SelectableColumn({
                        id: 'dueAt',
                        name: $t(`eae99aeb-eb79-4a91-8e84-5364cbc74364`),
                    }),

                    ...Object.values(BalanceItemRelationType).map(relationType => new SelectableColumn({
                        id: `relations.${relationType}`,
                        name: getBalanceItemRelationTypeName(relationType),
                        description: getBalanceItemRelationTypeDescription(relationType),
                    })),

                    new SelectableColumn({
                        id: 'quantity',
                        name: $t(`697df3e7-fbbf-421d-81c2-9c904dce4842`),
                    }),

                    new SelectableColumn({
                        id: 'unitPrice',
                        name: $t(`bab8d047-63db-4d0f-82c7-3a8d69a85745`),
                    }),

                    new SelectableColumn({
                        id: 'payablePriceWithVAT',
                        name: $t(`52bff8d2-52af-4d3f-b092-96bcfa4c0d03`),
                    }),

                    new SelectableColumn({
                        id: 'priceOpen',
                        name: $t(`Openstaand bedrag op {date}`, { date: Formatter.date(new Date(), true) }),
                    }),

                    new SelectableColumn({
                        id: 'pricePaid',
                        name: $t(`Totaal betaald bedrag op {date}`, { date: Formatter.date(new Date(), true) }),
                    }),

                    new SelectableColumn({
                        id: 'pricePending',
                        name: $t(`Totaal bedrag in verwerking op {date}`, { date: Formatter.date(new Date(), true) }),
                    }),

                    ...[Formatter.year(new Date()) - 2, Formatter.year(new Date()) - 1, Formatter.year(new Date())].map(year => new SelectableColumn({
                        id: `paidIn[${year}]`,
                        name: $t('Betaald in {year}', { year: year.toFixed(0) }),
                        enabled: false,
                    })),

                    ...[Formatter.year(new Date()) - 2, Formatter.year(new Date()) - 1, Formatter.year(new Date())].map(year => new SelectableColumn({
                        id: `chargedIn[${year}]`,
                        name: $t('Aangerekend in {year}', { year: year.toFixed(0) }),
                        description: $t('Indien het aangerekende bedrag aangerekend werd in dit jaar wordt het herhaald, anders 0.'),
                        enabled: false,
                    })),
                ],
            }),
        ],
    });
}
