import { XlsxBuiltInNumberFormat } from "@stamhoofd/excel-writer";
import { ExcelExportType, PaymentGeneral } from "@stamhoofd/structures";
import { ExportToExcelEndpoint } from "../endpoints/global/files/ExportToExcelEndpoint";
import { GetPaymentsEndpoint } from "../endpoints/organization/dashboard/payments/GetPaymentsEndpoint";

ExportToExcelEndpoint.loaders.set(ExcelExportType.Payments, {
    fetch: GetPaymentsEndpoint.buildData.bind(GetPaymentsEndpoint),
    sheets: [
        {
            id: 'payments',
            name: 'Betalingen',
            columns: [
                {
                    id: 'id',
                    name: 'ID',
                    width: 20,
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
                    id: 'customer.company.name',
                    name: 'Bedrijfsnaam',
                    width: 20,
                    getValue: (object: PaymentGeneral) => ({value: object.customer?.company?.name || 'Particulier'})
                },
                {
                    id: 'customer.name',
                    name: 'Naam',
                    width: 20,
                    getValue: (object: PaymentGeneral) => ({value: object.customer?.name || ''})
                },
                {
                    id: 'price',
                    name: 'Bedrag',
                    width: 20,
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
                    id: 'createdAt',
                    name: 'Aangemaakt op',
                    width: 20,
                    getValue: (object: PaymentGeneral) => ({
                        value: object.createdAt,
                        style: {
                            numberFormat: {
                                id: XlsxBuiltInNumberFormat.DateTimeSlash
                            }
                        }
                    })
                }
            ]
        }
    ]
})
