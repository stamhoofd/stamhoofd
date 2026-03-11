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
                name: $t(`fbe6e4c4-8d98-41b5-b839-11d469031002`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`12b569c7-c600-4148-bac3-91a823c55ea5`),
                        description: $t(`c9e92a50-8f3f-47fb-b598-c3930527b9a5`),
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
                        name: $t(`11d6f2fc-c72d-4c18-aa6d-b8118c2aaa5c`),
                    }),

                    new SelectableColumn({
                        id: 'createdAt',
                        name: $t(`10a1cf76-0757-4c92-9923-a19cd77fe24c`),
                    }),

                    new SelectableColumn({
                        id: 'dueAt',
                        name: $t(`3d586760-01f3-42c3-82be-44cea7ad0820`),
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
                        name: $t(`7453643b-fdb2-4aa1-9964-ddd71762c983`),
                    }),

                    new SelectableColumn({
                        id: 'payablePriceWithVAT',
                        name: $t(`1205deb9-498d-435d-a6e1-91ea98371523`),
                    }),

                    new SelectableColumn({
                        id: 'priceOpen',
                        name: $t(`ab32d1bb-a43f-4f02-b419-5a698a16011d`, { date: Formatter.date(new Date(), true) }),
                    }),

                    new SelectableColumn({
                        id: 'pricePaid',
                        name: $t(`bcf60659-dd2d-4932-8754-b4b7e6f48111`, { date: Formatter.date(new Date(), true) }),
                    }),

                    new SelectableColumn({
                        id: 'pricePending',
                        name: $t(`58d00379-f597-4505-9330-e7ec02a33029`, { date: Formatter.date(new Date(), true) }),
                    }),

                    ...[Formatter.year(new Date()) - 2, Formatter.year(new Date()) - 1, Formatter.year(new Date())].map(year => new SelectableColumn({
                        id: `paidIn[${year}]`,
                        name: $t('7df15807-0b2d-487f-8c97-deb8ce79d07b', { year: year.toFixed(0) }),
                        enabled: false,
                    })),

                    ...[Formatter.year(new Date()) - 2, Formatter.year(new Date()) - 1, Formatter.year(new Date())].map(year => new SelectableColumn({
                        id: `chargedIn[${year}]`,
                        name: $t('91748032-ca3b-49c2-b065-ddfcb9fd460e', { year: year.toFixed(0) }),
                        description: $t('ae505bd5-5008-4da9-b1aa-6351ecd1ef7e'),
                        enabled: false,
                    })),
                ],
            }),
        ],
    });
}
