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
                name: $t(`Betalingen`),
                description: $t(`Dit werkblad bevat één rij per betaling, maar een betaling zelf kan wel voor meerdere items zijn. Voor meer detailinformatie heb je het tabblad Betaallijnen nodig.`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`ID`),
                        description: $t(`Unieke identificatie van de betaling`),
                    }),

                    new SelectableColumn({
                        id: 'price',
                        name: $t(`Prijs`),
                    }),

                    new SelectableColumn({
                        id: 'description',
                        name: $t(`Detail`),
                        description: $t(`De inschrijvingen of producten die zijn afgerekend`),
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
                name: $t(`Betaallijnen`),
                description: $t(`Een betaling kan soms voor meerdere items tegelijk zijn. Dat is vaak nuttige informatie omdat je die items soms anders moet verwerken in je boekhouding. Als je dit werkblad exporteert, krijgt elk item een aparte lijn met bijhorende informatie.`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`ID`),
                        description: $t(`Unieke identificatie van de betaallijn`),
                    }),

                    new SelectableColumn({
                        id: 'paymentId',
                        name: $t(`Betaling ID`),
                        description: $t(`Unieke identificatie van de betaling`),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.type',
                        name: $t(`Type`),
                        description: Formatter.joinLast(Object.values(BalanceItemType).map(type => getBalanceItemTypeName(type)), ', ', ' ' + $t(`en`) + ' '),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.category',
                        name: $t(`Categorie`),
                        description: $t(`Extra kolom om betalingen makkelijker te groeperen. Dit bevat de naam van de activiteit/groep, de naam van de webshop of de beschrijving bij andere aanrekeningen.`),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.description',
                        name: $t(`Beschrijving`),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.createdAt',
                        name: $t(`Aangerekend op`),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.dueAt',
                        name: $t(`Verschuldigd vanaf`),
                    }),

                    ...Object.values(BalanceItemRelationType).map(relationType => new SelectableColumn({
                        id: `balanceItem.relations.${relationType}`,
                        name: getBalanceItemRelationTypeName(relationType),
                        description: getBalanceItemRelationTypeDescription(relationType),
                    })),

                    new SelectableColumn({
                        id: 'amount',
                        name: $t(`Aantal`),
                    }),

                    new SelectableColumn({
                        id: 'unitPrice',
                        name: $t(`Eenheidsprijs`),
                    }),

                    new SelectableColumn({
                        id: 'price',
                        name: $t(`Prijs`),
                    }),

                    ...getGeneralColumns({ category: $t(`Betaling (herhaling)`) }),

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
                name: $t(`Betaalstatus`),
                ...options,
            }),

            new SelectableColumn({
                id: 'method',
                name: $t(`Betaalmethode`),
                ...options,
            }),

            new SelectableColumn({
                id: 'provider',
                name: $t(`Betaalprovider`),
                ...options,
            }),

            new SelectableColumn({
                id: 'createdAt',
                name: $t(`Aangemaakt op`),
                ...options,
            }),

            new SelectableColumn({
                id: 'paidAt',
                name: $t(`Betaald op`),
                ...options,
            }),
        ];
    }
}

function getSettlementColumns() {
    return [
        new SelectableColumn({
            id: 'settlement.reference',
            name: $t(`Uitbetalingsmededeling`),
            description: $t(`De mededeling die de betaalprovider heeft gebruikt bij de uitbetaling`),
            category: $t(`Uitbetaling`),
        }),
        new SelectableColumn({
            id: 'settlement.settledAt',
            name: $t(`Uitbetalingsdatum`),
            description: $t(`Datum waarop de betaling werd uitbetaald door de betaalprovider`),
            category: $t(`Uitbetaling`),
        }),
        new SelectableColumn({
            id: 'settlement.amount',
            name: $t(`Uitbetalingsbedrag`),
            description: $t(`Totale bedrag dat werd uitbetaald door de betaalprovider in de uitbetaling (bevat dus ook andere betalingen)`),
            category: $t(`Uitbetaling`),
        }),
    ];
}

function getStripeColumns() {
    return [
        new SelectableColumn({
            id: 'transferFee',
            name: $t(`Transactiekosten`),
            description: $t(`Transactiekosten die in mindering worden gebracht door de betaalprovider`),
            category: $t(`Stripe`),
        }),
        new SelectableColumn({
            id: 'stripeAccountId',
            name: $t(`Account ID`),
            description: $t(`Stripe Account ID waarop de betaling is ontvangen`),
            category: $t(`Stripe`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'iban',
            name: $t(`Kaartnummer`),
            description: $t(`De laatste 4 cijfers van de IBAN-rekeningnummer of creditcard van de betaler`),
            category: $t(`Stripe`),
        }),
        new SelectableColumn({
            id: 'ibanName',
            name: $t(`Kaarthouder`),
            description: $t(`Naam van de betaler volgens de bank`),
            category: $t(`Stripe`),
        }),
    ];
}

function getTransferColumns() {
    return [
        new SelectableColumn({
            id: 'transferDescription',
            name: $t(`Mededeling`),
            description: $t(`Mededeling van de betaling`),
            category: $t(`Overschrijvingen`),
        }),
        new SelectableColumn({
            id: 'transferSettings.creditor',
            name: $t(`Begunstigde`),
            description: $t(`De eigenaar van de rekening waarnaar de betaler heeft overgeschreven`),
            category: $t(`Overschrijvingen`),
        }),
        new SelectableColumn({
            id: 'transferSettings.iban',
            name: $t(`Rekeningnummer begunstigde`),
            description: $t(`Rekeningnummer waarnaar de betaler heeft overgeschreven`),
            category: $t(`Overschrijvingen`),
        }),
    ];
}

function getPayingOrganizationColumns() {
    return [
        new SelectableColumn({
            id: 'payingOrganization.id',
            name: $t(`ID betalende groep`),
            category: $t(`Betalende groep`),
            enabled: false,
        }),

        new SelectableColumn({
            id: 'payingOrganization.uri',
            name: $t(`Groepsnummer betalende groep`),
            category: $t(`Betalende groep`),
        }),

        new SelectableColumn({
            id: 'payingOrganization.name',
            name: $t(`Naam betalende groep`),
            category: $t(`Betalende groep`),
        }),
    ];
}

function getInvoiceColumns() {
    return [
        new SelectableColumn({
            id: 'customer.name',
            name: $t(`Naam`),
            description: $t(`Naam van de betaler`),
            category: $t(`Facturatiegegevens`),
        }),
        new SelectableColumn({
            id: 'customer.email',
            name: $t(`E-mailadres`),
            description: $t(`E-mailadres van de betaler`),
            category: $t(`Facturatiegegevens`),
        }),

        new SelectableColumn({
            id: 'customer.company.name',
            name: $t(`Bedrijfsnaam`),
            category: $t(`Facturatiegegevens`),
        }),

        new SelectableColumn({
            id: 'customer.company.VATNumber',
            name: $t(`BTW-nummer`),
            category: $t(`Facturatiegegevens`),
        }),

        new SelectableColumn({
            id: 'customer.company.companyNumber',
            name: $t(`Ondernemingsnummer`),
            category: $t(`Facturatiegegevens`),
        }),

        new SelectableColumn({
            id: 'customer.company.address',
            name: $t(`Bedrijfsadres`),
            category: $t(`Facturatiegegevens`),
        }),

        new SelectableColumn({
            id: 'customer.company.administrationEmail',
            name: $t(`E-mailadres administratie`),
            category: $t(`Facturatiegegevens`),
        }),
    ];
}
