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
    name: $t('3f4c9896-7f02-4b49-ad29-2d363a8af71f'),
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
            name: $t(`a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc`),
            width: 30,
            getValue: (registration: PlatformRegistration) => {
                return {
                    value: registration.groupPrice.name.toString(),
                };
            },
        },
        {
            id: 'price',
            name: $t(`a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc`),
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
            name: $t(`18aed6d0-0880-4d06-9260-fe342e6e8064`),
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
            name: $t(`28c2bc66-231f-44f3-9249-c1981b871a1f`),
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
            name: $t(`8895f354-658f-48bd-9d5d-2e0203ca2a36`),
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
            name: $t(`300d2935-b578-48cc-b58e-1c0446a68d59`),
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
            name: $t(`3c90169c-9776-4d40-bda0-dba27a5bad69`),
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
            name: $t('63a86cdf-8a76-4e8c-9073-4f0b8970e808'),
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
                    value: organization?.name ?? $t('49e90fda-d262-4fe7-a2e2-d6b48abc8e2b'),
                });
            },
        },
        {
            id: 'uri',
            name: $t('05723781-9357-41b2-9fb8-cb4f80dde7f9'),
            width: 40,
            getValue: (registration: PlatformRegistration) => {
                const organization = registration.member.family.getOrganization(registration.group.organizationId);
                return ({
                    value: organization?.uri ?? $t('49e90fda-d262-4fe7-a2e2-d6b48abc8e2b'),
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
                    value = organization ? organization.name : $t(`49e90fda-d262-4fe7-a2e2-d6b48abc8e2b`);
                }
                else {
                    value = $t(`08dd4181-69c6-4888-b32a-07224f1c4349`);
                }

                return ({
                    value,
                });
            },
        },
        {
            id: 'trialUntil',
            name: $t(`1f2e9d09-717b-4c17-9bbe-dce3f3dcbff0`),
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
                        name: $t(`792ebf47-4ad3-4d9c-a4ab-f315b715e70e`),
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
            name: $t(`05723781-9357-41b2-9fb8-cb4f80dde7f9`),
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
            name: $t('23671282-34da-4da9-8afd-503811621055'),
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
