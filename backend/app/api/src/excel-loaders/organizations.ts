import { XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { ExcelExportType, LimitedFilteredRequest, Organization as OrganizationStruct } from '@stamhoofd/structures';
import { GetOrganizationsEndpoint } from '../endpoints/admin/organizations/GetOrganizationsEndpoint';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint';

// Assign to a typed variable to assure we have correct type checking in place
const sheet: XlsxTransformerSheet<OrganizationStruct, OrganizationStruct> = {
    id: 'organizations',
    name: 'Leden',
    columns: [
        {
            id: 'id',
            name: 'ID',
            width: 20,
            getValue: (object: OrganizationStruct) => ({
                value: object.id,
            }),
        },
        {
            id: 'uri',
            name: 'Groepsnummer',
            width: 20,
            getValue: (object: OrganizationStruct) => ({
                value: object.uri,
            }),
        },
        {
            id: 'name',
            name: 'Naam',
            width: 50,
            getValue: (object: OrganizationStruct) => ({
                value: object.name,
            }),
        },
    ],
};

ExportToExcelEndpoint.loaders.set(ExcelExportType.Organizations, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetOrganizationsEndpoint.buildData(query);

        return result;
    },
    sheets: [
        sheet,
    ],
});
