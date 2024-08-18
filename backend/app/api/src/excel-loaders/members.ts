import { XlsxBuiltInNumberFormat } from "@stamhoofd/excel-writer";
import { ExcelExportType, LimitedFilteredRequest, PaginatedResponse, MemberWithRegistrationsBlob } from "@stamhoofd/structures";
import { ExportToExcelEndpoint } from "../endpoints/global/files/ExportToExcelEndpoint";
import { GetMembersEndpoint } from "../endpoints/global/members/GetMembersEndpoint";

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
                }
            ]
        }
    ]
})
