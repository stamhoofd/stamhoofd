import { XlsxBuiltInNumberFormat, XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { Platform } from '@stamhoofd/models';
import { ExcelExportType, getGroupTypeName, LimitedFilteredRequest, PlatformMember, PlatformRegistration, Platform as PlatformStruct, UnencodeablePaginatedResponse } from '@stamhoofd/structures';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { GetRegistrationsEndpoint } from '../endpoints/global/registration/GetRegistrationsEndpoint.js';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures.js';
import { Context } from '../helpers/Context.js';
import { XlsxTransformerColumnHelper } from '../helpers/XlsxTransformerColumnHelper.js';
import { baseMemberColumns } from './members.js';

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
            id: 'priceName',
            name: $t(`dcc53f25-f0e9-4e3e-9f4f-e8cfa4e88755`),
            width: 30,
            getValue: (registration: PlatformRegistration) => {
                return {
                    value: registration.groupPrice.name.toString(),
                };
            },
        },
        {
            id: 'price',
            name: $t(`dcc53f25-f0e9-4e3e-9f4f-e8cfa4e88755`),
            width: 30,
            getValue: (registration: PlatformRegistration) => {
                return {
                    value: registration.balances.reduce((sum, r) => sum + (r.amountOpen + r.amountPaid + r.amountPending), 0) / 1_0000,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                        },
                    },
                };
            },
        },
        {
            id: 'toPay',
            width: 30,
            name: $t(`3a97e6cb-012d-4007-9c54-49d3e5b72909`),
            getValue: (registration: PlatformRegistration) => {
                return {
                    value: registration.balances.reduce((sum, r) => sum + (r.amountOpen + r.amountPending), 0) / 1_0000,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                        },
                    },
                };
            },

        },
        {
            id: 'outstandingBalance',
            name: $t(`beb45452-dee7-4a7f-956c-e6db06aac20f`),
            width: 30,
            getValue: (v) => {
                return {
                    value: v.member.member.balances.reduce((sum, r) => sum + (r.amountOpen), 0) / 1_0000,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                        },
                    },
                };
            },

        },
        {
            id: 'registeredAt',
            name: $t(`Inschrijvingsdatum`),
            width: 20,
            getValue: (registration: PlatformRegistration) => ({
                value: registration.registeredAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'startDate',
            name: $t(`bbe0af99-b574-4719-a505-ca2285fa86e4`),
            width: 20,
            getValue: (registration: PlatformRegistration) => ({
                value: registration.startDate,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'endDate',
            name: $t(`EindDatum`),
            width: 20,
            getValue: (registration: PlatformRegistration) => ({
                value: registration.endDate,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'createdAt',
            name: $t('Aanmaakdatum lid'),
            width: 20,
            getValue: (registration: PlatformRegistration) => ({
                value: registration.member.member.createdAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'organization',
            name: $t('2f325358-6e2f-418c-9fea-31a14abbc17a'),
            width: 40,
            getValue: (registration: PlatformRegistration) => {
                const organization = registration.member.family.getOrganization(registration.group.organizationId);
                return ({
                    value: organization?.name ?? $t('836c2cd3-32a3-43f2-b09c-600170fcd9cb'),
                });
            },
        },
        {
            id: 'uri',
            name: $t('9d283cbb-7ba2-4a16-88ec-ff0c19f39674'),
            width: 40,
            getValue: (registration: PlatformRegistration) => {
                const organization = registration.member.family.getOrganization(registration.group.organizationId);
                return ({
                    value: organization?.uri ?? $t('836c2cd3-32a3-43f2-b09c-600170fcd9cb'),
                });
            },
        },
        {
            id: 'groupRegistration',
            name: $t('7289b10e-a284-40ea-bc57-8287c6566a82'),
            width: 40,
            getValue: (registration: PlatformRegistration) => {
                let value: string;

                if (registration.payingOrganizationId) {
                    const organization = registration.member.organizations.find(o => o.id === registration.payingOrganizationId);
                    value = organization ? organization.name : $t(`bd1e59c8-3d4c-4097-ab35-0ce7b20d0e50`);
                }
                else {
                    value = $t(`b8b730fb-f1a3-4c13-8ec4-0aebe08a1449`);
                }

                return ({
                    value,
                });
            },
        },
        {
            id: 'trialUntil',
            name: $t(`Proefperiode`),
            width: 40,
            getValue: (registration: PlatformRegistration) => {
                let value: Date | null = null;
                if (registration.trialUntil && registration.trialUntil > new Date()) {
                    value = new Date(registration.trialUntil.getTime());
                }

                return {
                    value,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.DateSlash,
                        },
                    },
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
                                value: options.map(option => returnAmount ? option.amount : option.option.name).join(', '),
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
        {
            id: 'organization',
            name: $t(`afd7843d-f355-445b-a158-ddacf469a5b1`),
            width: 40,
            getValue: (registration: PlatformRegistration) => {
                return {
                    value: registration.member.organizations.find(o => o.id === registration.organizationId)?.name ?? '',
                };
            },
        },
        {
            id: 'uri',
            name: $t(`27cfaf26-6b88-4ebc-a50a-627a9f0f9e64`),
            width: 30,
            getValue: (registration: PlatformRegistration) => {
                return {
                    value: registration.member.organizations.find(o => o.id === registration.organizationId)?.uri ?? '',
                };
            },
        },
        {
            id: 'group',
            name: $t(`0c230001-c3be-4a8e-8eab-23dc3fd96e52`),
            width: 40,
            getValue: (registration: PlatformRegistration) => {
                return {
                    value: registration.group.settings.name.toString(),
                };
            },
        },
        {
            id: 'defaultAgeGroup',
            name: $t(`0ef2bbb3-0b3c-411a-8901-a454cff1f839`),
            width: 40,
            getValue: (registration: PlatformRegistration) => {
                const defaultAgeGroupId = registration.group.defaultAgeGroupId;
                if (!defaultAgeGroupId) {
                    return {
                        value: '',
                    };
                }
                return {
                    value: PlatformStruct.shared.config.defaultAgeGroups.find(g => g.id === defaultAgeGroupId)?.name ?? $t(`6aeee253-beb2-4548-b60e-30836afcf2f0`),
                };
            },
        },
        {
            id: 'group.type',
            name: $t('Type'),
            width: 20,
            getValue: (registration: PlatformRegistration) => {
                return {
                    value: getGroupTypeName(registration.group.type),
                };
            },
        },
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
