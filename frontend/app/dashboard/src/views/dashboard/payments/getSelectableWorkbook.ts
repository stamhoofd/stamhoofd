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
                name: $t(`290c7beb-61c7-425d-b35e-333aba83bbc5`),
                description: $t(`5794f2b1-0a86-481b-a3ea-4224c6f68ea8`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`8daf57de-69cf-48fe-b09b-772c54473184`),
                        description: $t(`fb8cd9a0-f531-4b1a-9a5c-dfb6b4957e22`),
                    }),

                    new SelectableColumn({
                        id: 'price',
                        name: $t(`52bff8d2-52af-4d3f-b092-96bcfa4c0d03`),
                    }),

                    new SelectableColumn({
                        id: 'description',
                        name: $t(`204f8618-c061-449d-aa74-5085e67b1d24`),
                        description: $t(`17c0327e-3206-4f14-a246-d215c97299f5`),
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
                name: $t(`d62b3102-adc0-4d5f-9dbb-c03138e44fe2`),
                description: $t(`21966b9d-cd06-4fb0-8ad3-f70be8ce888c`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`ID`),
                        description: $t(`8388c47d-9510-4bbb-b1f5-c9c3476da7e2`),
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.id',
                        name: $t(`Aanrekening ID`),
                        description: $t(`Unieke identificatie van de aanrekening die betaald werd`),
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'paymentId',
                        name: $t(`fe6593de-6156-4021-98b3-c470b7e593f2`),
                        description: $t(`fb8cd9a0-f531-4b1a-9a5c-dfb6b4957e22`),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.type',
                        name: $t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`),
                        description: Formatter.joinLast(Object.values(BalanceItemType).map(type => getBalanceItemTypeName(type)), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' '),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.category',
                        name: $t(`502dc65d-e8d3-4b20-a478-a76ca9084e60`),
                        description: $t(`9bedb14f-45cf-4cf8-b0ca-7e3e96485d95`),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.description',
                        name: $t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.createdAt',
                        name: $t(`a6eb80ee-4da2-4b74-ad1b-cd3af3fe5fca`),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.dueAt',
                        name: $t(`eae99aeb-eb79-4a91-8e84-5364cbc74364`),
                    }),

                    ...Object.values(BalanceItemRelationType).map(relationType => new SelectableColumn({
                        id: `balanceItem.relations.${relationType}`,
                        name: getBalanceItemRelationTypeName(relationType),
                        description: getBalanceItemRelationTypeDescription(relationType),
                    })),

                    new SelectableColumn({
                        id: 'amount',
                        name: $t(`697df3e7-fbbf-421d-81c2-9c904dce4842`),
                    }),

                    new SelectableColumn({
                        id: 'unitPrice',
                        name: $t(`bab8d047-63db-4d0f-82c7-3a8d69a85745`),
                    }),

                    new SelectableColumn({
                        id: 'price',
                        name: $t(`52bff8d2-52af-4d3f-b092-96bcfa4c0d03`),
                    }),

                    ...getGeneralColumns({ category: $t(`8ef5c1e5-f960-433c-ae46-07e08fe4c309`) }),

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
                name: $t(`86d9d5ea-ef90-4252-9ad3-b66634d128f2`),
                ...options,
            }),

            new SelectableColumn({
                id: 'method',
                name: $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`),
                ...options,
            }),

            new SelectableColumn({
                id: 'provider',
                name: $t(`7dfb11a0-0064-4d9e-af68-b759d5a52746`),
                ...options,
            }),

            new SelectableColumn({
                id: 'createdAt',
                name: $t(`b6391640-1e01-47f9-913d-360fb0903b75`),
                ...options,
            }),

            new SelectableColumn({
                id: 'paidAt',
                name: $t(`445f778c-5d66-44d3-af4a-84254a4475ea`),
                ...options,
            }),
        ];
    }
}

function getSettlementColumns() {
    return [
        new SelectableColumn({
            id: 'settlement.reference',
            name: $t(`02b47907-73e2-4cb2-b398-784f6cbce23a`),
            description: $t(`c91575b5-7a97-46f6-a810-5ac4edabcf1e`),
            category: $t(`c8fe9bb8-8aa7-4491-9290-deab1f8c307c`),
        }),
        new SelectableColumn({
            id: 'settlement.settledAt',
            name: $t(`4ff3b4aa-8668-4287-bce3-b06cde51ddb7`),
            description: $t(`44bebe90-52ae-4c55-b0ef-7ec09f43e7e3`),
            category: $t(`c8fe9bb8-8aa7-4491-9290-deab1f8c307c`),
        }),
        new SelectableColumn({
            id: 'settlement.amount',
            name: $t(`285990a8-0565-4d38-a97f-a9c935096159`),
            description: $t(`d8559e69-90e8-4a0c-b3f9-53a0bc9d9707`),
            category: $t(`c8fe9bb8-8aa7-4491-9290-deab1f8c307c`),
        }),
    ];
}

function getStripeColumns() {
    return [
        new SelectableColumn({
            id: 'transferFee',
            name: $t(`94a93185-574a-415f-9212-32ba95111206`),
            description: $t(`e6fef5f5-3c6a-4879-b2d6-0dfb479cb047`),
            category: $t(`079c3c5d-b816-4adf-9287-6f5352a2cd81`),
        }),
        new SelectableColumn({
            id: 'stripeAccountId',
            name: $t(`e8ef97dc-5470-4d36-9c4a-a9c2ec92b7e2`),
            description: $t(`cefc0455-9e43-41ef-abe0-dec25b6a9927`),
            category: $t(`079c3c5d-b816-4adf-9287-6f5352a2cd81`),
            enabled: false,
        }),
        new SelectableColumn({
            id: 'iban',
            name: $t(`dc091655-124e-4dce-98c2-67061bf5ba14`),
            description: $t(`93735302-2cc1-41f5-91b7-ffb876d0d673`),
            category: $t(`079c3c5d-b816-4adf-9287-6f5352a2cd81`),
        }),
        new SelectableColumn({
            id: 'ibanName',
            name: $t(`037aebd6-adf9-4ddb-90f5-5d89aa7dee01`),
            description: $t(`2e1426dc-9e09-4bd4-9ed9-8e94ad407272`),
            category: $t(`079c3c5d-b816-4adf-9287-6f5352a2cd81`),
        }),
    ];
}

function getTransferColumns() {
    return [
        new SelectableColumn({
            id: 'transferDescription',
            name: $t(`136b7ba4-7611-4ee4-a46d-60758869210f`),
            description: $t(`840222e3-9637-4ef8-85ab-ec6f2db6946c`),
            category: $t(`6c58724b-afce-40a4-b11d-a6f6b86976b9`),
        }),
        new SelectableColumn({
            id: 'transferSettings.creditor',
            name: $t(`31c28f13-d3b8-42ee-8979-c8224633237e`),
            description: $t(`9e9c8bc3-757f-4914-bbee-18427d5b3897`),
            category: $t(`6c58724b-afce-40a4-b11d-a6f6b86976b9`),
        }),
        new SelectableColumn({
            id: 'transferSettings.iban',
            name: $t(`64d16d6d-bcf9-427f-9aaa-441e2f61a3ab`),
            description: $t(`c0f2e806-9d05-462e-897b-72af5a797b96`),
            category: $t(`6c58724b-afce-40a4-b11d-a6f6b86976b9`),
        }),
    ];
}

function getPayingOrganizationColumns() {
    return [
        new SelectableColumn({
            id: 'payingOrganization.id',
            name: $t(`73ddcf23-84a5-4911-9f1a-19fb101bf2d1`),
            category: $t(`fda60b74-9be2-4806-8f00-7c6745121bc3`),
            enabled: false,
        }),

        new SelectableColumn({
            id: 'payingOrganization.uri',
            name: $t(`711fa35a-e20e-4372-b807-09192714250e`),
            category: $t(`fda60b74-9be2-4806-8f00-7c6745121bc3`),
        }),

        new SelectableColumn({
            id: 'payingOrganization.name',
            name: $t(`5f25a20d-ca03-4155-88c6-f9ae3872c052`),
            category: $t(`fda60b74-9be2-4806-8f00-7c6745121bc3`),
        }),
    ];
}

function getInvoiceColumns() {
    return [
        new SelectableColumn({
            id: 'customer.name',
            name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
            description: $t(`c3fb131c-db42-41f3-935b-b4ce8a83b93d`),
            category: $t(`f777a982-6f69-41cc-bef1-18d146e870db`),
        }),
        new SelectableColumn({
            id: 'customer.email',
            name: $t(`7400cdce-dfb4-40e7-996b-4817385be8d8`),
            description: $t(`3242bf11-c6cb-414b-83aa-1087f33348cc`),
            category: $t(`f777a982-6f69-41cc-bef1-18d146e870db`),
        }),

        new SelectableColumn({
            id: 'customer.company.name',
            name: $t(`e016131d-770c-45fe-b6e9-5631761cbab2`),
            category: $t(`f777a982-6f69-41cc-bef1-18d146e870db`),
        }),

        new SelectableColumn({
            id: 'customer.company.VATNumber',
            name: $t(`4d2a6054-26bf-49ed-b91f-59a8819e6436`),
            category: $t(`f777a982-6f69-41cc-bef1-18d146e870db`),
        }),

        new SelectableColumn({
            id: 'customer.company.companyNumber',
            name: $t(`fb64a034-071e-45d6-8d78-6b5f291ee5f9`),
            category: $t(`f777a982-6f69-41cc-bef1-18d146e870db`),
        }),

        new SelectableColumn({
            id: 'customer.company.address',
            name: $t(`317dfe77-2167-4a40-9127-b7321f581327`),
            category: $t(`f777a982-6f69-41cc-bef1-18d146e870db`),
        }),

        new SelectableColumn({
            id: 'customer.company.administrationEmail',
            name: $t(`c61fb48a-1ba2-4af4-868e-c11ee25af768`),
            category: $t(`f777a982-6f69-41cc-bef1-18d146e870db`),
        }),
    ];
}
