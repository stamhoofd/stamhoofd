import { XlsxBuiltInNumberFormat, XlsxTransformerSheet } from '@stamhoofd/excel-writer';
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
    name: $t('938926c1-cb27-427d-aabd-638c5ec1d14a'),
    columns: [
        {
            id: 'id',
            name: $t(`29360811-3663-496c-8d8f-c9fdf9467a74`),
            width: 40,
            getValue: (registration: PlatformRegistration) => ({
                value: registration.id,
            }),
        },
        {
            id: 'price',
            name: $t(`dcc53f25-f0e9-4e3e-9f4f-e8cfa4e88755`),
            width: 30,
            getValue: (registration: PlatformRegistration) => {
                return {
                    value: registration.groupPrice.name.toString(),
                };
            },
        },
        // option menu
        {
            match(id) {
                if (!id.startsWith('optionMenu.')) {
                    return;
                }

                const splitted = id.split('.');

                if (splitted.length < 2) {
                    return;
                }

                const menuId = splitted[1];

                if (splitted.length > 2) {
                    const optionId = splitted[2];
                    const returnAmount = splitted.length > 3 && splitted[3] === 'amount';

                    return [{
                        id: `optionMenu.${menuId}.${optionId}${returnAmount ? '.amount' : ''}`,
                        name: $t(`d89d7fcd-ecf3-40a2-afb6-f51c3f6c9bc6`),
                        width: 30,
                        getValue: (registration: PlatformRegistration) => {
                            const options = registration.options.filter(o => o.optionMenu.id === menuId && o.option.id === optionId);

                            if (!options.length) {
                                return {
                                    value: '',
                                };
                            }

                            return {
                                style: options.length === 1 && returnAmount
                                    ? {
                                            numberFormat: {
                                                id: XlsxBuiltInNumberFormat.Number,
                                            },
                                        }
                                    : {},
                                value: options.length === 1 && returnAmount ? options[0].amount : options.map(option => returnAmount ? option.amount : option).join(', '),
                            };
                        },
                    }];
                }

                return [
                    {
                        id: `optionMenu.${menuId}`,
                        name: $t(`99e37a95-6a68-4921-a8db-08fb136f87dd`),
                        width: 30,
                        getValue: (registration: PlatformRegistration) => {
                            const options = registration.options.filter(o => o.optionMenu.id === menuId);

                            if (!options.length) {
                                return {
                                    value: '',
                                };
                            }

                            return {
                                value: options.map(option => (option.amount > 1 ? `${option.amount}x ` : '') + option.option.name).join(', '),
                            };
                        },
                    },
                ];
            },
        },
        // recordAnswers
        {
            match(id) {
                if (!id.startsWith('recordAnswers.')) {
                    return;
                }

                const splitted = id.split('.');

                if (splitted.length < 2) {
                    return;
                }

                const recordId = splitted[1];
                return [
                    {
                        id: `recordAnswers.${recordId}`,
                        name: 'Vraag',
                        width: 35,
                        getValue: (registration: PlatformRegistration) => {
                            return {
                                value: registration.recordAnswers.get(recordId)?.excelValues[0]?.value ?? '',
                            };
                        },
                    },
                ];
            },
        },
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
