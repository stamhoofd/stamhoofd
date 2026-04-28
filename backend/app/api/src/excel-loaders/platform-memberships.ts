import type { XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { XlsxBuiltInNumberFormat } from '@stamhoofd/excel-writer';
import type { LimitedFilteredRequest, PlatformMembership } from '@stamhoofd/structures';
import { ExcelExportType, PaginatedResponse, Platform } from '@stamhoofd/structures';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { GetPlatformMembershipsEndpoint } from '../endpoints/global/platform-memberships/GetPlatformMembershipsEndpoint.js';

// Assign to a typed variable to assure we have correct type checking in place
const sheet: XlsxTransformerSheet<PlatformMembership> = {
    id: 'platform-memberships',
    name: $t('%1EI'),
    columns: [
        {
            id: 'id',
            name: $t(`%d`),
            width: 40,
            getValue: (membership: PlatformMembership) => ({
                value: membership.id,
            }),
        },
        {
            id: 'type',
            name: $t('%1PC'),
            width: 40,
            getValue: (membership: PlatformMembership) => {
                const membershipType = Platform.shared.config.membershipTypes.find(m => m.id === membership.membershipTypeId);
                const value = membershipType ? membershipType.name : '';
                return {value};
            },
        },
        {
            id: 'startDate',
            name: $t('%1Of'),
            width: 20,
            getValue: (membership: PlatformMembership) => {
                return {
                    value: membership.startDate,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.DateSlash,
                        },
                    },
                };
            },
        },
        {
            id: 'endDate',
            name: $t('%1P8'),
            width: 20,
            getValue: (membership: PlatformMembership) => {
                return {
                    value: membership.endDate,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.DateSlash,
                        },
                    },
                };
            },
        },
        {
            id: 'price',
            name: $t('%1PO'),
            width: 10,
            getValue: (membership: PlatformMembership) => {
                return {
                    value: membership.price / 1_0000,
                    style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
                };
            },
        },
        {
            id: 'priceWithoutDiscount',
            name:  $t(`%1Nm`),
            width: 10,
            getValue: (membership: PlatformMembership) => {
                return {
                    value: membership.priceWithoutDiscount / 1_0000,
                    style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
                };
            },
        },
        {
            id: 'trialUntil',
            name: $t(`%1PU`),
            width: 20,
            getValue: (membership: PlatformMembership) => {
                return {
                    value: membership.trialUntil,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.DateSlash,
                        },
                    },
                };
            },
        },
        {
            id: 'freeAmount',
            name: $t(`%1Oo`),
            width: 40,
            getValue: (membership: PlatformMembership) => ({
                value: membership.freeAmount,
            }),
        },
        {
            id: 'createdAt',
            name: $t(`%1Oh`),
            width: 20,
            getValue: (membership: PlatformMembership) => {
                return {
                    value: membership.createdAt,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.DateSlash,
                        },
                    },
                };
            },
        },
        {
            id: 'expireDate',
            name: $t(`%1O0`),
            width: 20,
            getValue: (membership: PlatformMembership) => {
                return {
                    value: membership.expireDate,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.DateSlash,
                        },
                    },
                };
            },
        },
        // balance item
        {
            id: 'balanceItem.createdAt',
            name: $t(`%1OM`),
            width: 20,
            getValue: (membership: PlatformMembership) => ({
                value: membership.balanceItem?.createdAt ?? null,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'balanceItem.priceOpen',
            name: $t('%1Ni'),
            width: 10,
            getValue: (membership: PlatformMembership) => {
                return {
                    value: membership.balanceItem?.priceOpen ? ((membership.balanceItem?.priceOpen ?? 0) / 1_0000) : null,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                        },
                    },
                };
            },
        },
        {
            id: 'balanceItem.pricePaid',
            name: $t('%1OD'),
            width: 10,
            getValue: (membership: PlatformMembership) => {
                return {
                    value: membership.balanceItem?.pricePaid ? ((membership.balanceItem?.pricePaid ?? 0) / 1_0000) : null,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                        },
                    },
                };
            },
        },
        {
            id: 'balanceItem.pricePending',
            name: $t('%1OL'),
            width: 10,
            getValue: (membership: PlatformMembership) => {
                return {
                    value: membership.balanceItem?.pricePending ? ((membership.balanceItem?.pricePending ?? 0) / 1_0000) : null,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                        },
                    },
                };
            },
        },

        // member
        {
            id: 'member.memberNumber',
            name: $t(`%1PT`),
            width: 20,
            getValue: (membership: PlatformMembership) => ({
                value: membership.member.memberNumber,
            }),
        },
        {
            id: 'member.firstName',
            name: $t(`%1O8`),
            width: 20,
            getValue:(membership: PlatformMembership) => ({
                value: membership.member.firstName,
            }),
        },
        {
            id: 'member.lastName',
            name: $t(`%1Or`),
            width: 20,
            getValue:(membership: PlatformMembership) => ({
                value: membership.member.lastName,
            }),
        },
        // organization
        {
            id: 'organization.name',
            name: $t(`%1PW`),
            width: 20,
            getValue:(membership: PlatformMembership) => ({
                value: membership.organization.name,
            }),
        },
        {
            id: 'organization.uri',
            name: $t(`%1PZ`),
            width: 20,
            getValue:(membership: PlatformMembership) => ({
                value: membership.organization.uri,
            }),
        }
    ],
};


ExportToExcelEndpoint.loaders.set(ExcelExportType.PlatformMemberships, {
    fetch: async (query: LimitedFilteredRequest) => {
        const data = await GetPlatformMembershipsEndpoint.buildData(query);

        return new PaginatedResponse({
            results: data.results,
            next: data.next,
        });
    },
    sheets: [
        sheet,
    ],
});
