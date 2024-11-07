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
                name: 'Betalingen',
                description: 'Dit werkblad bevat één rij per betaling, maar een betaling zelf kan wel voor meerdere items zijn. Voor meer detailinformatie heb je het tabblad Betaallijnen nodig.',
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: 'ID',
                        description: 'Unieke identificatie van de betaling',
                    }),

                    new SelectableColumn({
                        id: 'price',
                        name: 'Prijs',
                    }),

                    new SelectableColumn({
                        id: 'description',
                        name: 'Detail',
                        description: 'De inschrijvingen of producten die zijn afgerekend',
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
                name: 'Betaallijnen',
                description: 'Een betaling kan soms voor meerdere items tegelijk zijn. Dat is vaak nuttige informatie omdat je die items soms anders moet verwerken in je boekhouding. Als je dit werkblad exporteert, krijgt elk item een aparte lijn met bijhorende informatie.',
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: 'ID',
                        description: 'Unieke identificatie van de betaallijn',
                    }),

                    new SelectableColumn({
                        id: 'paymentId',
                        name: 'Betaling ID',
                        description: 'Unieke identificatie van de betaling',
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.type',
                        name: 'Type',
                        description: Formatter.joinLast(Object.values(BalanceItemType).map(type => getBalanceItemTypeName(type)), ', ', ' en '),
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

                    ...getGeneralColumns({ category: 'Betaling (herhaling)' }),

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
                name: 'Betaalstatus',
                ...options,
            }),

            new SelectableColumn({
                id: 'method',
                name: 'Betaalmethode',
                ...options,
            }),

            new SelectableColumn({
                id: 'provider',
                name: 'Betaalprovider',
                ...options,
            }),

            new SelectableColumn({
                id: 'createdAt',
                name: 'Aangemaakt op',
                ...options,
            }),

            new SelectableColumn({
                id: 'paidAt',
                name: 'Betaald op',
                ...options,
            }),
        ];
    }
}

function getSettlementColumns() {
    return [
        new SelectableColumn({
            id: 'settlement.reference',
            name: 'Uitbetalingsmededeling',
            description: 'De mededeling die de betaalprovider heeft gebruikt bij de uitbetaling',
            category: 'Uitbetaling',
        }),
        new SelectableColumn({
            id: 'settlement.settledAt',
            name: 'Uitbetalingsdatum',
            description: 'Datum waarop de betaling werd uitbetaald door de betaalprovider',
            category: 'Uitbetaling',
        }),
        new SelectableColumn({
            id: 'settlement.amount',
            name: 'Uitbetalingsbedrag',
            description: 'Totale bedrag dat werd uitbetaald door de betaalprovider in de uitbetaling (bevat dus ook andere betalingen)',
            category: 'Uitbetaling',
        }),
    ];
}

function getStripeColumns() {
    return [
        new SelectableColumn({
            id: 'transferFee',
            name: 'Transactiekosten',
            description: 'Transactiekosten die in mindering worden gebracht door de betaalprovider',
            category: 'Stripe',
        }),
        new SelectableColumn({
            id: 'stripeAccountId',
            name: 'Account ID',
            description: 'Stripe Account ID waarop de betaling is ontvangen',
            category: 'Stripe',
            enabled: false,
        }),
        new SelectableColumn({
            id: 'iban',
            name: 'Kaartnummer',
            description: 'De laatste 4 cijfers van de IBAN-rekeningnummer of creditcard van de betaler',
            category: 'Stripe',
        }),
        new SelectableColumn({
            id: 'ibanName',
            name: 'Kaarthouder',
            description: 'Naam van de betaler volgens de bank',
            category: 'Stripe',
        }),
    ];
}

function getTransferColumns() {
    return [
        new SelectableColumn({
            id: 'transferDescription',
            name: 'Mededeling',
            description: 'Mededeling van de betaling',
            category: 'Overschrijvingen',
        }),
        new SelectableColumn({
            id: 'transferSettings.creditor',
            name: 'Begunstigde',
            description: 'De eigenaar van de rekening waarnaar de betaler heeft overgeschreven',
            category: 'Overschrijvingen',
        }),
        new SelectableColumn({
            id: 'transferSettings.iban',
            name: 'Rekeningnummer begunstigde',
            description: 'Rekeningnummer waarnaar de betaler heeft overgeschreven',
            category: 'Overschrijvingen',
        }),
    ];
}

function getPayingOrganizationColumns() {
    return [
        new SelectableColumn({
            id: 'payingOrganization.id',
            name: 'ID betalende groep',
            category: 'Betalende groep',
            enabled: false,
        }),

        new SelectableColumn({
            id: 'payingOrganization.uri',
            name: 'Groepsnummer betalende groep',
            category: 'Betalende groep',
        }),

        new SelectableColumn({
            id: 'payingOrganization.name',
            name: 'Naam betalende groep',
            category: 'Betalende groep',
        }),
    ];
}

function getInvoiceColumns() {
    return [
        new SelectableColumn({
            id: 'customer.name',
            name: 'Naam',
            description: 'Naam van de betaler',
            category: 'Facturatiegegevens',
        }),
        new SelectableColumn({
            id: 'customer.email',
            name: 'E-mailadres',
            description: 'E-mailadres van de betaler',
            category: 'Facturatiegegevens',
        }),

        new SelectableColumn({
            id: 'customer.company.name',
            name: 'Bedrijfsnaam',
            category: 'Facturatiegegevens',
        }),

        new SelectableColumn({
            id: 'customer.company.VATNumber',
            name: 'BTW-nummer',
            category: 'Facturatiegegevens',
        }),

        new SelectableColumn({
            id: 'customer.company.companyNumber',
            name: 'Ondernemingsnummer',
            category: 'Facturatiegegevens',
        }),

        new SelectableColumn({
            id: 'customer.company.address',
            name: 'Bedrijfsadres',
            category: 'Facturatiegegevens',
        }),

        new SelectableColumn({
            id: 'customer.company.administrationEmail',
            name: 'E-mailadres administratie',
            category: 'Facturatiegegevens',
        }),
    ];
}
