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
                id: 'receivableBalances',
                name: 'Te ontvangen bedragen',
                description: 'Dit werkblad bevat één rij per te ontvangen bedrag, maar een te ontvangen bedrag zelf kan wel voor meerdere items zijn. Voor meer detailinformatie heb je het tabblad Betaallijnen nodig.',
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: 'ID',
                        description: 'Unieke identificatie van de betaling',
                    }),

                    ...getGeneralColumns(),
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

                    new SelectableColumn({
                        id: 'balanceItem.type',
                        name: 'Type',
                        description: Formatter.joinLast(Object.values(BalanceItemType).map(type => getBalanceItemTypeName(type)), ', ', ' en '),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.category',
                        name: 'Categorie',
                        description: 'Extra kolom om lijnen makkelijker te groeperen. Dit bevat de naam van de activiteit/groep, de naam van de webshop of de beschrijving bij andere aanrekeningen.',
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.description',
                        name: 'Beschrijving',
                    }),

                    ...Object.values(BalanceItemRelationType).map(relationType => new SelectableColumn({
                        id: `balanceItem.relations.${relationType}`,
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
                        id: 'createdAt',
                        name: 'Aangemaakt op',
                    }),

                    new SelectableColumn({
                        id: 'dueAt',
                        name: 'Vervaldatum',
                    }),

                    new SelectableColumn({
                        id: 'status',
                        name: 'status',
                    }),

                    ...getGeneralColumns({ category: 'Te ontvangen bedragen (herhaling)' }),
                ],
            }),
        ],
    });
}

function getGeneralColumns(options?: { category?: string | null }) {
    {
        return [
            new SelectableColumn({
                id: 'amountPaid',
                name: 'Betaald bedrag',
                ...options,
            }),

            new SelectableColumn({
                id: 'amountOpen',
                name: 'Openstaand bedrag',
                ...options,
            }),

            new SelectableColumn({
                id: 'amountPending',
                name: 'In verwerking',
                ...options,
            }),

            new SelectableColumn({
                id: 'objectType',
                name: 'type',
                ...options,
            }),

            new SelectableColumn({
                id: 'createdAt',
                name: 'Aangemaakt op',
                ...options,
            }),
        ];
    }
}
