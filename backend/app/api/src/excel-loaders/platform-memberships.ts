import { field, StringDecoder } from '@simonbackx/simple-encoding';
import type { XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { XlsxBuiltInNumberFormat } from '@stamhoofd/excel-writer';
import { RegistrationPeriod } from '@stamhoofd/models';
import type { LimitedFilteredRequest, Platform as PlatformStruct } from '@stamhoofd/structures';
import { ExcelExportType, PaginatedResponse, PlatformMembership } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { GetPlatformMembershipsEndpoint } from '../endpoints/global/platform-memberships/GetPlatformMembershipsEndpoint.js';

class PlatformMembershipWithPeriod extends PlatformMembership {
    @field({ decoder: StringDecoder })
    periodName: string;
}

// Assign to a typed variable to assure we have correct type checking in place
const getSheet = (platform: PlatformStruct): XlsxTransformerSheet<PlatformMembershipWithPeriod> => ({
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
            name: $t('%1LP'),
            width: 40,
            getValue: (membership: PlatformMembership) => {
                const membershipType = platform.config.membershipTypes.find(m => m.id === membership.membershipTypeId);
                const value = membershipType ? membershipType.name : '';
                return { value };
            },
        },
        {
            id: 'periodId',
            name: $t('%7Z'),
            width: 20,
            getValue: (membership: PlatformMembershipWithPeriod) => ({
                value: membership.periodName,
            }),
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
            name: $t('%1IP'),
            width: 10,
            getValue: (membership: PlatformMembership) => {
                return {
                    value: membership.price === null ? null : membership.price / 1_0000,
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
            name: $t(`%1Nm`),
            width: 10,
            getValue: (membership: PlatformMembership) => {
                return {
                    value: membership.priceWithoutDiscount === null ? null : membership.priceWithoutDiscount / 1_0000,
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
            name: $t(`%1Jc`),
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
            name: $t(`%1J7`),
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
            name: $t(`%19j`),
            width: 20,
            getValue: (membership: PlatformMembership) => ({
                value: membership.member.memberNumber,
            }),
        },
        {
            id: 'member.birthDay',
            name: $t(`%17w`),
            width: 20,
            getValue: (membership: PlatformMembership) => ({
                value: membership.member.birthDay,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'member.firstName',
            name: $t(`%1O8`),
            width: 20,
            getValue: (membership: PlatformMembership) => ({
                value: membership.member.firstName,
            }),
        },
        {
            id: 'member.lastName',
            name: $t(`%1Or`),
            width: 20,
            getValue: (membership: PlatformMembership) => ({
                value: membership.member.lastName,
            }),
        },
        // organization
        {
            id: 'organization.name',
            name: $t(`%1PW`),
            width: 20,
            getValue: (membership: PlatformMembership) => ({
                value: membership.organization.name,
            }),
        },
        {
            id: 'organization.uri',
            name: $t(`%1PZ`),
            width: 20,
            getValue: (membership: PlatformMembership) => ({
                value: membership.organization.uri,
            }),
        },
    ],
});

ExportToExcelEndpoint.loaders.set(ExcelExportType.PlatformMemberships, {
    fetch: async (query: LimitedFilteredRequest) => {
        const data = await GetPlatformMembershipsEndpoint.buildData(query);
        const periodIds = Formatter.uniqueArray(data.results.map(membership => membership.periodId));
        const periods = await RegistrationPeriod.getByIDs(...periodIds);
        const periodMap = new Map(periods.map(period => [period.id, period.getBaseStructure().nameShort]));

        return new PaginatedResponse({
            results: data.results.map(membership => PlatformMembershipWithPeriod.create({
                ...membership,
                periodName: periodMap.get(membership.periodId) ?? membership.periodId,
            })),
            next: data.next,
        });
    },
    getSheets: platform => [
        getSheet(platform),
    ],
});
