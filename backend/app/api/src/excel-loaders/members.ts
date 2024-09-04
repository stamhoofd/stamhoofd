import { XlsxBuiltInNumberFormat } from "@stamhoofd/excel-writer";
import { ExcelExportType, Gender, LimitedFilteredRequest, MemberWithRegistrationsBlob, PaginatedResponse, Platform } from "@stamhoofd/structures";
import { ExportToExcelEndpoint } from "../endpoints/global/files/ExportToExcelEndpoint";
import { GetMembersEndpoint } from "../endpoints/global/members/GetMembersEndpoint";
import { Context } from "../helpers/Context";
import { XlsxTransformerColumnHelper } from "../helpers/xlsxAddressTransformerColumnFactory";

ExportToExcelEndpoint.loaders.set(ExcelExportType.Members, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetMembersEndpoint.buildData(query)

        return new PaginatedResponse({
            results: result.results.members,
            next: result.next
        });
    },
    sheets: [
        {
            id: 'members',
            name: 'Leden',
            columns: [
                {
                    id: 'id',
                    name: 'ID',
                    width: 20,
                    getValue: (object: MemberWithRegistrationsBlob) => ({
                        value: object.id
                    })
                },
                {
                    id: 'memberNumber',
                    name: 'Nummer',
                    width: 20,
                    getValue: (object: MemberWithRegistrationsBlob) => ({
                        value: object.details.memberNumber
                    })
                },
                {
                    id: 'firstName',
                    name: 'Voornaam',
                    width: 20,
                    getValue: (object: MemberWithRegistrationsBlob) => ({
                        value: object.details.firstName
                    })
                },
                {
                    id: 'lastName',
                    name: 'Achternaam',
                    width: 20,
                    getValue: (object: MemberWithRegistrationsBlob) => ({
                        value: object.details.lastName
                    })
                },
                {
                    id: 'birthDay',
                    name: 'Geboortedatum',
                    width: 20,
                    getValue: (object: MemberWithRegistrationsBlob) => ({
                        value: object.details.birthDay,
                        style: {
                            numberFormat: {
                                id: XlsxBuiltInNumberFormat.DateSlash
                            }
                        }
                    })
                },
                {
                    id: 'gender',
                    name: 'Geslacht',
                    width: 20,
                    getValue: (object: MemberWithRegistrationsBlob) => {
                        const gender = object.details.gender;

                        return ({
                            value: formatGender(gender)
                        })
                    }
                },
                {
                    id: 'uitpasNumber',
                    name: 'UiTPAS-nummer',
                    width: 20,
                    getValue: (object: MemberWithRegistrationsBlob) => ({
                        value: object.details.uitpasNumber,
                    })
                },
                {
                    id: 'phone',
                    name: 'Telefoonnummer',
                    width: 20,
                    getValue: (object: MemberWithRegistrationsBlob) => ({
                        value: object.details.phone,
                    })
                },
                {
                    id: 'email',
                    name: 'E-mailadres',
                    width: 20,
                    getValue: (object: MemberWithRegistrationsBlob) => ({
                        value: object.details.email,
                    })
                },
                XlsxTransformerColumnHelper.createAddressColumns<MemberWithRegistrationsBlob>({
                    matchId: 'address',
                    getAddress: (object) => object.details.address,
                }),
                ...XlsxTransformerColumnHelper.creatColumnsForParents(),

                // parent 1

                // parent 2

                // unverified data
                {
                    id: 'unverifiedEmails',
                    name: 'Niet-geverifieerde e-mails',
                    width: 20,
                    getValue: (object: MemberWithRegistrationsBlob) => ({
                        value: object.details.unverifiedEmails.join(', '),
                    })
                },
                {
                    id: 'unverifiedPhones',
                    name: 'Niet-geverifieerde telefoonnummers',
                    width: 20,
                    getValue: (object: MemberWithRegistrationsBlob) => ({
                        value: object.details.unverifiedPhones.join(', '),
                    })
                },
                {
                    id: 'unverifiedAddresses',
                    name: 'Niet-geverifieerde adressen',
                    width: 20,
                    getValue: (object: MemberWithRegistrationsBlob) => ({
                        value: object.details.unverifiedAddresses.map(a => a.toString()).join('; '),
                    })
                },

                // Dynamic records
                {
                    match(id) {
                        console.log('match', id)
                        if (id.startsWith('recordAnswers.')) {
                            const platform = Platform.shared
                            const organization = Context.organization

                            const recordSettings = [
                                ...(organization?.meta.recordsConfiguration.recordCategories.flatMap(category => category.getAllRecords()) ?? []),
                                ...platform.config.recordsConfiguration.recordCategories.flatMap(category => category.getAllRecords())
                            ]

                            const recordSettingId = id.split('.')[1];
                            console.log('recordSettingId', recordSettingId)
                            const recordSetting = recordSettings.find(r => r.id === recordSettingId)
                            

                            if (!recordSetting) {
                                // Will throw a proper error itself
                                console.log('recordSetting not found', recordSettings)
                                return
                            }

                            const columns = recordSetting.excelColumns

                            return columns.map((columnName, index) => {
                                return {
                                    id: `recordAnswers.${recordSettingId}.${index}`,
                                    name: columnName,
                                    width: 20,
                                    getValue: (object: MemberWithRegistrationsBlob) => ({
                                        value: object.details.recordAnswers.get(recordSettingId)?.excelValues[index]?.value ?? ''
                                    })
                                }
                            })
                        }
                    },
                }
            ]
        }
    ]
})

function formatGender(gender: Gender) {
    switch(gender) {
        case Gender.Male: return 'Man';
        case Gender.Female: return 'Vrouw';
        default: return 'Andere';
    }
}
