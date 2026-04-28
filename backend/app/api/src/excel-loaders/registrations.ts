import type { XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { XlsxBuiltInNumberFormat } from '@stamhoofd/excel-writer';
import { Platform } from '@stamhoofd/models';
import type { LimitedFilteredRequest, PlatformMember} from '@stamhoofd/structures';
import { ExcelExportType, getGroupTypeName, PlatformRegistration, Platform as PlatformStruct, UnencodeablePaginatedResponse } from '@stamhoofd/structures';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { GetRegistrationsEndpoint } from '../endpoints/global/registration/GetRegistrationsEndpoint.js';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures.js';
import { Context } from '../helpers/Context.js';
import { XlsxTransformerColumnHelper } from '../helpers/XlsxTransformerColumnHelper.js';
import { baseMemberColumns } from './members.js';

// Assign to a typed variable to assure we have correct type checking in place
const sheet: XlsxTransformerSheet<PlatformMember, PlatformRegistration> = {
    id: 'registrations',
    name: $t('%1EI'),
    columns: [
        {
            id: 'id',
            name: $t(`%d`),
            width: 40,
            getValue: (registration: PlatformRegistration) => ({
                value: registration.id,
            }),
        },
        {
            id: 'priceName',
            name: $t(`%62`),
            width: 30,
            getValue: (registration: PlatformRegistration) => {
                return {
                    value: registration.groupPrice.name.toString(),
                };
            },
        },
        {
            id: 'price',
            name: $t(`%62`),
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
            name: $t(`%m0`),
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
            name: $t(`%76`),
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
            name: $t(`%zg`),
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
            name: $t(`%1Of`),
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
            name: $t(`%1P8`),
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
            name: $t('%1IG'),
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
            name: $t('%1PI'),
            width: 40,
            getValue: (registration: PlatformRegistration) => {
                const organization = registration.member.family.getOrganization(registration.group.organizationId);
                return ({
                    value: organization?.name ?? $t('%Gr'),
                });
            },
        },
        {
            id: 'uri',
            name: $t('%1O1'),
            width: 40,
            getValue: (registration: PlatformRegistration) => {
                const organization = registration.member.family.getOrganization(registration.group.organizationId);
                return ({
                    value: organization?.uri ?? $t('%Gr'),
                });
            },
        },
        {
            id: 'groupRegistration',
            name: $t('%8t'),
            width: 40,
            getValue: (registration: PlatformRegistration) => {
                let value: string;

                if (registration.payingOrganizationId) {
                    const organization = registration.member.organizations.find(o => o.id === registration.payingOrganizationId);
                    value = organization ? organization.name : $t(`%Gr`);
                }
                else {
                    value = $t(`%18s`);
                }

                return ({
                    value,
                });
            },
        },
        {
            id: 'trialUntil',
            name: $t(`%1IH`),
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
                        name: $t(`%wO`),
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
                        name: $t(`%Tb`),
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
            name: $t(`%wA`),
            width: 40,
            getValue: (registration: PlatformRegistration) => {
                return {
                    value: registration.member.organizations.find(o => o.id === registration.organizationId)?.name ?? '',
                };
            },
        },
        {
            id: 'uri',
            name: $t(`%1O1`),
            width: 30,
            getValue: (registration: PlatformRegistration) => {
                return {
                    value: registration.member.organizations.find(o => o.id === registration.organizationId)?.uri ?? '',
                };
            },
        },
        {
            id: 'group',
            name: $t(`%wH`),
            width: 40,
            getValue: (registration: PlatformRegistration) => {
                return {
                    value: registration.group.settings.name.toString(),
                };
            },
        },
        {
            id: 'defaultAgeGroup',
            name: $t(`%wI`),
            width: 40,
            getValue: (registration: PlatformRegistration) => {
                const defaultAgeGroupId = registration.group.defaultAgeGroupId;
                if (!defaultAgeGroupId) {
                    return {
                        value: '',
                    };
                }
                return {
                    value: PlatformStruct.shared.config.defaultAgeGroups.find(g => g.id === defaultAgeGroupId)?.name ?? $t(`%wJ`),
                };
            },
        },
        {
            id: 'group.type',
            name: $t('%1LP'),
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
