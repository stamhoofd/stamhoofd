import { XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { Platform } from '@stamhoofd/models';
import { ExcelExportType, LimitedFilteredRequest, PlatformMember, PlatformRegistration, UnencodeablePaginatedResponse } from '@stamhoofd/structures';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint';
import { GetRegistrationsEndpoint } from '../endpoints/global/registration/GetRegistrationsEndpoint';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures';
import { Context } from '../helpers/Context';
import { XlsxTransformerColumnHelper } from '../helpers/XlsxTransformerColumnHelper';
import { baseMemberColumns } from './members';

// Assign to a typed variable to assure we have correct type checking in place
const sheet: XlsxTransformerSheet<PlatformMember, PlatformRegistration> = {
    id: 'registrations',
    name: $t('Inschrijvingen'),
    columns: [
        {
            id: 'id',
            name: $t(`29360811-3663-496c-8d8f-c9fdf9467a74`),
            width: 40,
            getValue: (registration: PlatformRegistration) => ({
                value: registration.id,
            }),
        },
        // todo: add more columns (see group columns for members)
        ...baseMemberColumns.map(column => XlsxTransformerColumnHelper.transformColumnForProperty({
            column,
            key: 'member',
            getPropertyValue: (registration: PlatformRegistration) => registration.member,
        })),
    ],
};

ExportToExcelEndpoint.loaders.set(ExcelExportType.Registrations, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetRegistrationsEndpoint.buildData(query);

        return new UnencodeablePaginatedResponse({
            results: PlatformRegistration.createSingles(result.results, {
                contextOrganization: Context.organization ? (await AuthenticatedStructures.organization(Context.organization)) : null,
                platform: await Platform.getSharedStruct(),
            }),
            next: result.next,
        });
    },
    sheets: [
        sheet,
    ],
});
