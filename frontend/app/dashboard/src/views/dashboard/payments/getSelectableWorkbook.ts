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
                name: $t(`15589562-1e34-4197-8097-5ec5bf1636fb`),
                description: $t(`5794f2b1-0a86-481b-a3ea-4224c6f68ea8`),
                columns: [
                    new SelectableColumn({
                        id: 'id',
                        name: $t(`8daf57de-69cf-48fe-b09b-772c54473184`),
                        description: $t(`fb8cd9a0-f531-4b1a-9a5c-dfb6b4957e22`),
                    }),

                    new SelectableColumn({
                        id: 'price',
                        name: $t(`1205deb9-498d-435d-a6e1-91ea98371523`),
                    }),

                    new SelectableColumn({
                        id: 'description',
                        name: $t(`151006be-86c2-48cd-bcd7-7c3bf9b76080`),
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
                        name: $t(`12b569c7-c600-4148-bac3-91a823c55ea5`),
                        description: $t(`8388c47d-9510-4bbb-b1f5-c9c3476da7e2`),
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.id',
                        name: $t(`89594841-9a44-473f-8250-0ccafb570b6f`),
                        description: $t(`998d38b2-dda4-4620-8986-62453d73ef87`),
                        enabled: false,
                    }),

                    new SelectableColumn({
                        id: 'paymentId',
                        name: $t(`0601033f-1678-4781-96cd-1653448d689a`),
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
                        name: $t(`11d6f2fc-c72d-4c18-aa6d-b8118c2aaa5c`),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.createdAt',
                        name: $t(`10a1cf76-0757-4c92-9923-a19cd77fe24c`),
                    }),

                    new SelectableColumn({
                        id: 'balanceItem.dueAt',
                        name: $t(`3d586760-01f3-42c3-82be-44cea7ad0820`),
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
                        name: $t(`7453643b-fdb2-4aa1-9964-ddd71762c983`),
                    }),

                    new SelectableColumn({
                        id: 'price',
                        name: $t(`1205deb9-498d-435d-a6e1-91ea98371523`),
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
                name: $t(`126040d7-3625-45c5-b561-4bf6c5baac12`),
                ...options,
            }),

            new SelectableColumn({
                id: 'createdAt',
                name: $t(`10fd24bb-43dd-4174-9a23-db3ac54af9be`),
                ...options,
            }),

            new SelectableColumn({
                id: 'paidAt',
                name: $t(`297af5d5-1cb0-4862-b8d4-13416bdefa9f`),
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
            name: $t(`02754274-677a-4911-9a32-8422a8d9f827`),
            description: $t(`e6fef5f5-3c6a-4879-b2d6-0dfb479cb047`),
            category: $t(`079c3c5d-b816-4adf-9287-6f5352a2cd81`),
        }),
        new SelectableColumn({
            id: 'stripeAccountId',
            name: $t(`a7f32979-1ee8-47fe-a409-7b17ce9f9d39`),
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
            category: $t(`2b09865c-4f3c-44ab-b001-03fc1d5a0ce9`),
        }),
        new SelectableColumn({
            id: 'customer.email',
            name: $t(`237d0720-13f0-4029-8bf2-4de7e0a9a358`),
            description: $t(`3242bf11-c6cb-414b-83aa-1087f33348cc`),
            category: $t(`2b09865c-4f3c-44ab-b001-03fc1d5a0ce9`),
        }),

        new SelectableColumn({
            id: 'customer.company.name',
            name: $t(`67928a02-b3f1-465a-9dd7-569d061599a9`),
            category: $t(`2b09865c-4f3c-44ab-b001-03fc1d5a0ce9`),
        }),

        new SelectableColumn({
            id: 'customer.company.VATNumber',
            name: $t(`263b7054-d38f-4bb9-be63-84b4e614613d`),
            category: $t(`2b09865c-4f3c-44ab-b001-03fc1d5a0ce9`),
        }),

        new SelectableColumn({
            id: 'customer.company.companyNumber',
            name: $t(`12f64ea7-fb54-4178-8267-9de12bdf70d7`),
            category: $t(`2b09865c-4f3c-44ab-b001-03fc1d5a0ce9`),
        }),

        new SelectableColumn({
            id: 'customer.company.address',
            name: $t(`317dfe77-2167-4a40-9127-b7321f581327`),
            category: $t(`2b09865c-4f3c-44ab-b001-03fc1d5a0ce9`),
        }),

        new SelectableColumn({
            id: 'customer.company.administrationEmail',
            name: $t(`8eb5f50e-d00d-444d-979a-f80ae834eb9a`),
            category: $t(`2b09865c-4f3c-44ab-b001-03fc1d5a0ce9`),
        }),
    ];
}
