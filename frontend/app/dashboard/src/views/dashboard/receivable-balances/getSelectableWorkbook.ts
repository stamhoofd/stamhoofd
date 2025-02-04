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
                name: 'Te ontvangen bedragen',
                description: 'Dit werkblad bevat één rij per te ontvangen bedrag, maar een te ontvangen bedrag zelf kan wel voor meerdere items zijn. Voor meer detailinformatie heb je het tabblad Betaallijnen nodig.',
                columns: [
                    ...getGeneralColumns($t, $feature),
                    new SelectableColumn({
                        id: 'amountOpen',
                        name: 'Openstaand bedrag',
                    }),
                    new SelectableColumn({
                        id: 'amountPending',
                        name: 'In verwerking',
                    }),
                ],
            }),
            new SelectableSheet({
                id: 'balanceItems',
                name: 'Lijnen',
                description: 'Een openstaand bedrag kan soms voor meerdere items tegelijk zijn. Dat is vaak nuttige informatie omdat je die items soms anders moet verwerken in je boekhouding. Als je dit werkblad exporteert, krijgt elk item een aparte lijn met bijhorende informatie.',
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: 'ID',
                        description: 'Unieke identificatie van de lijn',
                    }),

                    ...getGeneralColumns($t, $feature, { category: 'Schuldenaar (herhaling)' }).map((c) => {
                        c.id = `receivableBalance.${c.id}`;
                        return c;
                    }),

                    new SelectableColumn({
                        id: 'type',
                        name: 'Type',
                        description: Formatter.joinLast(Object.values(BalanceItemType).map(type => getBalanceItemTypeName(type)), ', ', ' en '),
                    }),

                    new SelectableColumn({
                        id: 'category',
                        name: 'Categorie',
                        description: 'Extra kolom om lijnen makkelijker te groeperen. Dit bevat de naam van de activiteit/groep, de naam van de webshop of de beschrijving bij andere aanrekeningen.',
                    }),

                    new SelectableColumn({
                        id: 'description',
                        name: 'Beschrijving',
                    }),

                    ...Object.values(BalanceItemRelationType).map(relationType => new SelectableColumn({
                        id: `relations.${relationType}`,
                        name: getBalanceItemRelationTypeName(relationType),
                        description: getBalanceItemRelationTypeDescription(relationType),
                    })),

                    new SelectableColumn({
                        id: 'amount',
                        name: 'Aantal',
                    }),

                    new SelectableColumn({
                        id: 'unitPrice',
                        name: 'Eenheidsprijs',
                    }),

                    new SelectableColumn({
                        id: 'price',
                        name: 'Prijs',
                    }),

                    new SelectableColumn({
                        id: 'pricePaid',
                        name: 'Betaald bedrag',
                    }),

                    new SelectableColumn({
                        id: 'pricePending',
                        name: 'In verwerking',
                    }),

                    new SelectableColumn({
                        id: 'priceOpen',
                        name: 'Openstaand bedrag',
                    }),

                    new SelectableColumn({
                        id: 'createdAt',
                        name: 'Aangemaakt op',
                    }),

                    new SelectableColumn({
                        id: 'dueAt',
                        name: 'Verschuldigd vanaf',
                    }),

                    new SelectableColumn({
                        id: 'status',
                        name: 'Status',
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
                name: 'ID schuldenaar',
                description: 'Unieke identificatie van de schuldenaar',
            }),
            new SelectableColumn({
                id: 'name',
                name: 'Schuldenaar',
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
                name: 'Type schuldenaar',
                ...options,
            }),
        ];
    }
}
