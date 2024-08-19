import { XlsxBuiltInNumberFormat, XlsxTransformerColumn } from "@stamhoofd/excel-writer";
import { BalanceItemPaymentDetailed, BalanceItemRelationType, CountryHelper, ExcelExportType, getBalanceItemRelationTypeName, getBalanceItemTypeName, PaymentGeneral, PaymentMethodHelper, PaymentStatusHelper } from "@stamhoofd/structures";
import { ExportToExcelEndpoint } from "../endpoints/global/files/ExportToExcelEndpoint";
import { GetPaymentsEndpoint } from "../endpoints/organization/dashboard/payments/GetPaymentsEndpoint";

type PaymentWithItem = {
    payment: PaymentGeneral,
    balanceItemPayment: BalanceItemPaymentDetailed
}

ExportToExcelEndpoint.loaders.set(ExcelExportType.Payments, {
    fetch: GetPaymentsEndpoint.buildData.bind(GetPaymentsEndpoint),
    sheets: [
        {
            id: 'payments',
            name: 'Betalingen',
            columns: [
                ...getGeneralColumns(),
                ...getInvoiceColumns(),
                ...getSettlementColumns(),
                ...getStripeColumns(),
                ...getTransferColumns(),
            ]
        },
        {
            id: 'balanceItemPayments',
            name: 'Betaallijnen',
            transform: (data: PaymentGeneral) => data.balanceItemPayments.map(p => ({
                payment: data,
                balanceItemPayment: p
            })),
            columns: [
                ...getBalanceItemColumns()
            ]
        }
    ]
})

function getBalanceItemColumns(): XlsxTransformerColumn<PaymentWithItem>[] {
    return [
        {
            id: 'id',
            name: 'ID',
            width: 35,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.id,
                style: {
                    font: {
                        bold: true
                    }
                }
            })
        },
        {
            id: 'paymentId',
            name: 'Betaling ID',
            width: 35,
            getValue: (object: PaymentWithItem) => ({
                value: object.payment.id
            })
        },
        {
            id: 'balanceItem.type',
            name: 'Type',
            width: 30,
            getValue: (object: PaymentWithItem) => ({
                value: getBalanceItemTypeName(object.balanceItemPayment.balanceItem.type)
            })
        },
        {
            match: (id) => {
                if (id.startsWith('balanceItem.relations.')) {
                    const type = id.split('.')[2] as BalanceItemRelationType;
                    if (Object.values(BalanceItemRelationType).includes(type)) {
                        return [
                            {
                                id: `balanceItem.relations.${type}`,
                                name: getBalanceItemRelationTypeName(type),
                                width: 35,
                                getValue: (object: PaymentWithItem) => ({
                                    value: object.balanceItemPayment.balanceItem.relations.get(type)?.name || ''
                                })
                            }
                        ]
                    }
                }
            }
        },
        {
            id: 'amount',
            name: 'Aantal',
            width: 20,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.amount,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Number
                    }
                }
            })
        },
        {
            id: 'unitPrice',
            name: 'Eenheidsprijs',
            width: 20,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.unitPrice / 100,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed
                    }
                }
            })
        },
        {
            id: 'price',
            name: 'Prijs',
            width: 20,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.price / 100,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed
                    }
                }
            })
        },
    ]
}


function getGeneralColumns(): XlsxTransformerColumn<PaymentGeneral>[] {
    return [
        {
            id: 'id',
            name: 'ID',
            width: 35,
            getValue: (object: PaymentGeneral) => ({
                value: object.id,
                style: {
                    font: {
                        bold: true
                    }
                }
            })
        },
        {
            id: 'price',
            name: 'Bedrag',
            width: 10,
            getValue: (object: PaymentGeneral) => ({
                value: object.price / 100,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed
                    }
                }
            })
        },
        {
            id: 'status',
            name: 'Status',
            width: 18,
            getValue: (object: PaymentGeneral) => ({
                value: PaymentStatusHelper.getNameCapitalized(object.status)
            })
        },
        {
            id: 'method',
            name: 'Betaalmethode',
            width: 18,
            getValue: (object: PaymentGeneral) => ({
                value: PaymentMethodHelper.getNameCapitalized(object.method)
            })
        },
        {
            id: 'provider',
            name: 'Betaalprovider',
            width: 16,
            getValue: (object: PaymentGeneral) => ({
                value: object.provider
            })
        },
        {
            id: 'createdAt',
            name: 'Aangemaakt op',
            width: 16,
            getValue: (object: PaymentGeneral) => ({
                value: object.createdAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateTimeSlash
                    }
                }
            })
        },
        {
            id: 'paidAt',
            name: 'Betaald op',
            width: 16,
            getValue: (object: PaymentGeneral) => ({
                value: object.paidAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateTimeSlash
                    }
                }
            })
        },
        {
            id: 'description',
            name: 'Detail',
            width: 60,
            getValue: (object: PaymentGeneral) => ({
                value: object.balanceItemPayments.map(p => p.toString()).join('\n'),
                style: {
                    alignment: {
                        wrapText: true
                    }
                }
            })
        },
    ]
}

function getSettlementColumns(): XlsxTransformerColumn<PaymentGeneral>[] {
    return [
        {
            id: 'settlement.reference',
            name: 'Uitbetalingsmededeling',
            width: 21,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.settlement?.reference || ''
                }
            }
        },
        {
            id: 'settlement.settledAt',
            name: 'Uitbetalingsdatum',
            width: 16,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.settlement?.settledAt ?? null,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.DateSlash
                        }
                    }
                }
            }
        },
        {
            id: 'settlement.amount',
            name: 'Uitbetalingsbedrag',
            width: 18,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.settlement?.amount !== undefined ? (object.settlement?.amount / 100) : null,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed
                        }
                    }
                }
            }
        },
        {
            id: 'settlement.fee',
            name: 'Uitbetalingstransactiekosten',
            width: 25,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.settlement?.fee !== undefined ? (object.settlement?.fee / 100) : null,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed
                        }
                    }
                }
            }
        }
    ]
}

function getStripeColumns(): XlsxTransformerColumn<PaymentGeneral>[] {
    return [
        {
            id: 'transferFee',
            name: 'Transactiekosten',
            width: 16,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.transferFee / 100,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed
                        }
                    }
                }
            }
        },
        {
            id: 'stripeAccountId',
            name: 'Account ID',
            width: 16,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.stripeAccountId || ''
                }
            }
        },
        {
            id: 'iban',
            name: 'Kaartnummer',
            width: 20,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.iban || ''
                }
            }
        },
        {
            id: 'ibanName',
            name: 'Kaarthouder',
            width: 20,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.ibanName || ''
                }
            }
        }
    ]
}

function getTransferColumns(): XlsxTransformerColumn<PaymentGeneral>[] {
    return [
        {
            id: 'transferDescription',
            name: 'Mededeling',
            width: 20,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.transferDescription || ''
                }
            }
        },
        {
            id: 'transferSettings.creditor',
            name: 'Begunstigde',
            width: 20,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.transferSettings?.creditor || ''
                }
            }
        },
        {
            id: 'transferSettings.iban',
            name: 'Rekeningnummer begunstigde',
            width: 20,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.transferSettings?.iban || ''
                }
            }
        },
    ]
}

function getInvoiceColumns(): XlsxTransformerColumn<PaymentGeneral>[] {
    return [
        {
            id: 'customer.name',
            name: 'Naam',
            width: 30,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.customer?.name || ''
                }
            }
        },
        {
            id: 'customer.email',
            name: 'E-mailadres',
            width: 40,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.customer?.email || ''
                }
            }
        },
        {
            id: 'customer.company.name',
            name: 'Bedrijfsnaam',
            width: 30,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.customer?.company?.name || ''
                }
            }
        },
        {
            id: 'customer.company.VATNumber',
            name: 'BTW-nummer',
            width: 20,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.customer?.company?.VATNumber || ''
                }
            }
        },
        {
            id: 'customer.company.companyNumber',
            name: 'Ondernemingsnummer',
            width: 20,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.customer?.company?.companyNumber || ''
                }
            }
        },
        {
            match: (id) => {
                if (id === 'customer.company.address') {
                    return [
                        {
                            id: 'customer.company.address.street',
                            name: 'Bedrijfsadres - Straat',
                            width: 30,
                            getValue: (object: PaymentGeneral) => {
                                return {
                                    value: object.customer?.company?.address?.street || ''
                                }
                            }
                        },
                        {
                            id: 'customer.company.address.number',
                            name: 'Bedrijfsadres - Huisnummer',
                            width: 20,
                            getValue: (object: PaymentGeneral) => {
                                return {
                                    value: object.customer?.company?.address?.number || ''
                                }
                            }
                        },
                        {
                            id: 'customer.company.address.postalCode',
                            name: 'Bedrijfsadres - Postcode',
                            width: 20,
                            getValue: (object: PaymentGeneral) => {
                                return {
                                    value: object.customer?.company?.address?.postalCode || ''
                                }
                            }
                        },
                        {
                            id: 'customer.company.address.city',
                            name: 'Bedrijfsadres - Stad',
                            width: 20,
                            getValue: (object: PaymentGeneral) => {
                                return {
                                    value: object.customer?.company?.address?.city || ''
                                }
                            }
                        },
                        {
                            id: 'customer.company.address.country',
                            name: 'Bedrijfsadres - Land',
                            width: 20,
                            getValue: (object: PaymentGeneral) => {
                                return {
                                    value: object.customer?.company?.address?.country ? CountryHelper.getName(object.customer?.company?.address?.country) : ''
                                }
                            }
                        }
                    ]
                }
            }
        },
        {
            id: 'customer.company.administrationEmail',
            name: 'E-mailadres administratie',
            width: 30,
            getValue: (object: PaymentGeneral) => {
                return {
                    value: object.customer?.company?.administrationEmail || ''
                }
            }
        },
    ]
}
