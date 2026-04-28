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
            name: $t('Type'),
            width: 40,
            getValue: (membership: PlatformMembership) => {
                const membershipType = Platform.shared.config.membershipTypes.find(m => m.id === membership.membershipTypeId);
                const value = membershipType ? membershipType.name : '';
                return {value};
            },
        },
        {
            id: 'startDate',
            name: $t('Startdatum'),
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
            name: $t('Einddatum'),
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
            name: $t('Prijs'),
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
            name:  $t(`Prijs zonder korting`),
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
            name: $t(`Einde proefperiode`),
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
            name: $t(`Dagen gratis`),
            width: 40,
            getValue: (membership: PlatformMembership) => ({
                value: membership.freeAmount,
            }),
        },
        {
            id: 'createdAt',
            name: $t(`Aanmaakdatum`),
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
            name: $t(`Vervaldatum`),
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
            name: $t(`Aanrekeningsdatum`),
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
            name: $t('Openstaand'),
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
            name: $t('Betaald'),
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
            name: $t('In vewerking'),
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
            name: $t(`Lidnummer`),
            width: 20,
            getValue: (membership: PlatformMembership) => ({
                value: membership.member.memberNumber,
            }),
        },
        {
            id: 'member.firstName',
            name: $t(`Voornaam lid`),
            width: 20,
            getValue:(membership: PlatformMembership) => ({
                value: membership.member.firstName,
            }),
        },
        {
            id: 'member.lastName',
            name: $t(`Achternaam lid`),
            width: 20,
            getValue:(membership: PlatformMembership) => ({
                value: membership.member.lastName,
            }),
        },
        // organization
        {
            id: 'organization.name',
            name: $t(`Naam vereniging`),
            width: 20,
            getValue:(membership: PlatformMembership) => ({
                value: membership.organization.name,
            }),
        },
        {
            id: 'organization.uri',
            name: $t(`Nummer vereniging`),
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
