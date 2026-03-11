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
                id: 'payments',
                name: $t(`%1JH`),
                description: $t(`%Lv`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`%1P`),
                        description: $t(`%Lw`),
                    }),

                    new SelectableColumn({
                        id: 'price',
                        name: $t(`%1IP`),
                    }),

                    new SelectableColumn({
                        id: 'description',
                        name: $t(`%X`),
                        description: $t(`%Lx`),
                    }),

                    ...getGeneralColumns(),

                    ...getSettlementColumns(),
                    ...getStripeColumns(),
                    ...getTransferColumns(),

                    // Facturatiegegevens
                    ...getInvoiceColumns(),
                    ...getPayingOrganizationColumns(),

                ],
            }),
            new SelectableSheet({
                id: 'balanceItemPayments',
                name: $t(`%Ly`),
                description: $t(`%Lz`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`%1LS`),
                        description: $t(`%M0`),
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.id',
                        name: $t(`%1LE`),
                        description: $t(`%1Lr`),
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'paymentId',
                        name: $t(`%wU`),
                        description: $t(`%Lw`),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.type',
                        name: $t(`%1B`),
                        description: Formatter.joinLast(Object.values(BalanceItemType).map(type => getBalanceItemTypeName(type)), ', ', ' ' + $t(`%M1`) + ' '),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.category',
                        name: $t(`%M2`),
                        description: $t(`%M3`),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.description',
                        name: $t(`%6o`),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.createdAt',
                        name: $t(`%wV`),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.dueAt',
                        name: $t(`%wW`),
                    }),

                    ...Object.values(BalanceItemRelationType).map(relationType => new SelectableColumn({
                        id: `balanceItem.relations.${relationType}`,
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

                    ...getGeneralColumns({ category: $t(`%M5`) }),

                    // Facturatiegegevens
                    ...getInvoiceColumns(),
                    ...getPayingOrganizationColumns(),
                ],
            }),
        ],
    });
}

function getGeneralColumns(options?: { category?: string | null }) {
    {
        return [
            new SelectableColumn({
                id: 'status',
                name: $t(`%M6`),
                ...options,
            }),

            new SelectableColumn({
                id: 'method',
                name: $t(`%M7`),
                ...options,
            }),

            new SelectableColumn({
                id: 'provider',
                name: $t(`%wX`),
                ...options,
            }),

            new SelectableColumn({
                id: 'createdAt',
                name: $t(`%1JJ`),
                ...options,
            }),

            new SelectableColumn({
                id: 'paidAt',
                name: $t(`%wY`),
                ...options,
            }),
        ];
    }
}

function getSettlementColumns() {
    return [
        new SelectableColumn({
            id: 'settlement.reference',
            name: $t(`%M8`),
            description: $t(`%M9`),
            category: $t(`%MA`),
        }),
        new SelectableColumn({
            id: 'settlement.settledAt',
            name: $t(`%MB`),
            description: $t(`%MC`),
            category: $t(`%MA`),
        }),
        new SelectableColumn({
            id: 'settlement.amount',
            name: $t(`%MD`),
            description: $t(`%ME`),
            category: $t(`%MA`),
        }),
    ];
}

function getStripeColumns() {
    return [
        new SelectableColumn({
            id: 'transferFee',
            name: $t(`%wZ`),
            description: $t(`%MF`),
            category: $t(`%K`),
        }),
        new SelectableColumn({
            id: 'stripeAccountId',
            name: $t(`%1m`),
            description: $t(`%MG`),
            category: $t(`%K`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'iban',
            name: $t(`%MH`),
            description: $t(`%MI`),
            category: $t(`%K`),
        }),
        new SelectableColumn({
            id: 'ibanName',
            name: $t(`%MJ`),
            description: $t(`%MK`),
            category: $t(`%K`),
        }),
    ];
}

function getTransferColumns() {
    return [
        new SelectableColumn({
            id: 'transferDescription',
            name: $t(`%J8`),
            description: $t(`%ML`),
            category: $t(`%MM`),
        }),
        new SelectableColumn({
            id: 'transferSettings.creditor',
            name: $t(`%J5`),
            description: $t(`%MN`),
            category: $t(`%MM`),
        }),
        new SelectableColumn({
            id: 'transferSettings.iban',
            name: $t(`%MO`),
            description: $t(`%MP`),
            category: $t(`%MM`),
        }),
    ];
}

function getPayingOrganizationColumns() {
    return [
        new SelectableColumn({
            id: 'payingOrganization.id',
            name: $t(`%MQ`),
            category: $t(`%MR`),
            enabled: false,
        }),

        new SelectableColumn({
            id: 'payingOrganization.uri',
            name: $t(`%MS`),
            category: $t(`%MR`),
        }),

        new SelectableColumn({
            id: 'payingOrganization.name',
            name: $t(`%MT`),
            category: $t(`%MR`),
        }),
    ];
}

function getInvoiceColumns() {
    return [
        new SelectableColumn({
            id: 'customer.name',
            name: $t(`%Gq`),
            description: $t(`%MU`),
            category: $t(`%1Ke`),
        }),
        new SelectableColumn({
            id: 'customer.email',
            name: $t(`%1FK`),
            description: $t(`%MV`),
            category: $t(`%1Ke`),
        }),

        new SelectableColumn({
            id: 'customer.company.name',
            name: $t(`%1JI`),
            category: $t(`%1Ke`),
        }),

        new SelectableColumn({
            id: 'customer.company.VATNumber',
            name: $t(`%1CK`),
            category: $t(`%1Ke`),
        }),

        new SelectableColumn({
            id: 'customer.company.companyNumber',
            name: $t(`%wa`),
            category: $t(`%1Ke`),
        }),

        new SelectableColumn({
            id: 'customer.company.address',
            name: $t(`%MW`),
            category: $t(`%1Ke`),
        }),

        new SelectableColumn({
            id: 'customer.company.administrationEmail',
            name: $t(`%wb`),
            category: $t(`%1Ke`),
        }),
    ];
}
