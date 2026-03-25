import type { XlsxTransformerColumn, XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { XlsxBuiltInNumberFormat } from '@stamhoofd/excel-writer';
import { Platform } from '@stamhoofd/models';
import type { LimitedFilteredRequest, PlatformMember} from '@stamhoofd/structures';
import { ExcelExportType, Gender, GroupType, MembershipStatus, PlatformFamily, Platform as PlatformStruct, UnencodeablePaginatedResponse } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { GetMembersEndpoint } from '../endpoints/global/members/GetMembersEndpoint.js';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures.js';
import { Context } from '../helpers/Context.js';
import { XlsxTransformerColumnHelper } from '../helpers/XlsxTransformerColumnHelper.js';

export const baseMemberColumns: XlsxTransformerColumn<PlatformMember>[] = [
    {
        id: 'id',
        name: $t(`%d`),
        width: 40,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.id,
        }),
    },
    {
        id: 'memberNumber',
        name: $t(`%cH`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.memberNumber,
        }),
    },
    {
        id: 'firstName',
        name: $t(`%1MT`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.firstName,
        }),
    },
    {
        id: 'lastName',
        name: $t(`%1MU`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.lastName,
        }),
    },
    {
        id: 'birthDay',
        name: $t(`%17w`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.birthDay,
            style: {
                numberFormat: {
                    id: XlsxBuiltInNumberFormat.DateSlash,
                },
            },
        }),
    },
    {
        id: 'age',
        name: $t(`%9S`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.age,
        }),
    },
    {
        id: 'gender',
        name: $t(`%19i`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => {
            const gender = object.details.gender;

            return ({
                value: formatGender(gender),
            });
        },
    },
    {
        id: 'phone',
        name: $t(`%wD`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.phone,
        }),
    },
    {
        id: 'email',
        name: $t(`%1FK`),
        width: 40,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.email,
        }),
    },
    XlsxTransformerColumnHelper.createAddressColumns<PlatformMember>({
        matchId: 'address',
        getAddress: ({ patchedMember: object }: PlatformMember) => {
            // get member address if exists
            const memberAddress = object.details.address;
            if (memberAddress) {
                return memberAddress;
            }

            // else get address of first parent with address
            for (const parent of object.details.parents) {
                if (parent.address) {
                    return parent.address;
                }
            }

            return null;
        },
    }),
    {
        id: 'securityCode',
        name: $t(`%wE`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.securityCode,
        }),
    },
    {
        id: 'uitpasNumber',
        name: $t(`%wF`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.uitpasNumberDetails?.uitpasNumber ?? null,
        }),
    },
    {
        id: 'requiresFinancialSupport',
        // todo: use correct term
        name: $t(`%wG`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: XlsxTransformerColumnHelper.formatBoolean(object.details.hasFinancialSupportOrActiveUitpas),
        }),
    },
    {
        id: 'notes',
        name: $t(`%Ve`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.notes,
        }),
    },
    {
        id: 'nationalRegisterNumber',
        name: $t(`%wK`),
        width: 30,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.nationalRegisterNumber?.toString() ?? '',
        }),
    },
    {
        id: 'membership',
        name: $t(`%Wq`),
        width: 20,
        getValue: (member: PlatformMember) => {
            return {
                value: formatMembershipStatus(member.membershipStatus),
            };
        },
    },
    {
        id: 'organization',
        name: $t(`%wA`),
        width: 40,
        getValue: (member: PlatformMember) => {
            const organizations = member.filterOrganizations({ currentPeriod: true, types: [GroupType.Membership] });
            const str = Formatter.joinLast(organizations.map(o => o.name).sort(), ', ', ' ' + $t(`%M1`) + ' ') || Context.i18n.$t('%5D');

            return {
                value: str,
            };
        },
    },
    {
        id: 'uri',
        name: $t(`%7C`),
        width: 30,
        getValue: (member: PlatformMember) => {
            const organizations = member.filterOrganizations({ currentPeriod: true, types: [GroupType.Membership] });
            const str = Formatter.joinLast(organizations.map(o => o.uri).sort(), ', ', ' ' + $t(`%M1`) + ' ') || Context.i18n.$t('%5D');

            return {
                value: str,
            };
        },
    },

    ...XlsxTransformerColumnHelper.creatColumnsForParents(),

    // unverified data
    {
        id: 'unverifiedPhones',
        name: $t(`%wL`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.unverifiedPhones.join(', '),
        }),
    },
    {
        id: 'unverifiedEmails',
        name: $t(`%wM`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.unverifiedEmails.join(', '),
        }),
    },
    ...XlsxTransformerColumnHelper.createColumnsForAddresses<PlatformMember>({
        matchIdStart: 'unverifiedAddresses',
        getAddresses: object => object.patchedMember.details.unverifiedAddresses,
        limit: 2,
    }),
    {
        id: 'unverifiedAddresses',
        name: $t(`%wN`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.unverifiedAddresses.map(a => a.toString()).join('; '),
        }),
    },

    // Dynamic records
    XlsxTransformerColumnHelper.createRecordAnswersColumns({
        matchId: 'recordAnswers',
        getRecordAnswers: ({ patchedMember: object }: PlatformMember) => object.details.recordAnswers,
        getRecordCategories: () => {
            const platform = PlatformStruct.shared;
            const organization = Context.organization;

            return [
                ...(organization?.meta.recordsConfiguration.recordCategories ?? []),
                ...platform.config.recordsConfiguration.recordCategories,
            ];
        },
    }),
];

// Assign to a typed variable to assure we have correct type checking in place
const sheet: XlsxTransformerSheet<PlatformMember, PlatformMember> = {
    id: 'members',
    name: $t(`%1EH`),
    columns: [
        ...baseMemberColumns,
        {
            id: 'group',
            name: $t(`%wH`),
            width: 40,
            getValue: (member: PlatformMember) => {
                const groups = member.filterRegistrations({ currentPeriod: true, types: [GroupType.Membership], organizationId: Context.organization?.id });
                const str = Formatter.joinLast(Formatter.uniqueArray(groups.map(o => o.group.settings.name.toString())).sort(), ', ', ' ' + $t(`%M1`) + ' ') || Context.i18n.$t('%5D');

                return {
                    value: str,
                };
            },
        },
        {
            id: 'defaultAgeGroup',
            name: $t(`%wI`),
            width: 40,
            getValue: (member: PlatformMember) => {
                const groups = member.filterRegistrations({ currentPeriod: true, types: [GroupType.Membership], organizationId: Context.organization?.id });
                const defaultAgeGroupIds = Formatter.uniqueArray(groups.filter(o => o.group.defaultAgeGroupId));
                const defaultAgeGroups = defaultAgeGroupIds.map(o => PlatformStruct.shared.config.defaultAgeGroups.find(g => g.id === o.group.defaultAgeGroupId)?.name ?? $t(`%wJ`));
                const str = Formatter.joinLast(Formatter.uniqueArray(defaultAgeGroups).sort(), ', ', ' ' + $t(`%M1`) + ' ') || Context.i18n.$t('%5D');

                return {
                    value: str,
                };
            },
        },
        {
            id: 'outstandingBalance',
            name: $t(`%76`),
            width: 30,
            getValue: (v) => {
                return {
                    value: v.member.balances.reduce((sum, r) => sum + (r.amountOpen), 0) / 1_0000,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                        },
                    },
                };
            },

        },
        {
            id: 'createdAt',
            name: $t('%1Jc'),
            width: 20,
            getValue: v => ({
                value: v.member.createdAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },

        // Registration records
        {
            match(id) {
                if (id.startsWith('groups.')) {
                    const splitted = id.split('.');
                    if (splitted.length < 3) {
                        return;
                    }

                    const groupId = splitted[1];
                    const recordName = splitted[2];

                    function getRegistration(object: PlatformMember) {
                        return object.filterRegistrations({ groupIds: [groupId] })[0] ?? null;
                    }

                    if (recordName === 'price') {
                        // Tarief
                        return [
                            {
                                id: `groups.${groupId}.${recordName}`,
                                name: $t(`%62`),
                                width: 30,
                                getValue: (member: PlatformMember) => {
                                    const registration = getRegistration(member);
                                    if (!registration) {
                                        return {
                                            value: '',
                                        };
                                    }

                                    return {
                                        value: registration.groupPrice.name.toString(),
                                    };
                                },
                            },
                        ];
                    }

                    if (recordName === 'optionMenu') {
                        if (splitted.length < 4) {
                            return;
                        }

                        const menuId = splitted[3];

                        if (splitted.length > 4) {
                            const optionId = splitted[4];
                            const returnAmount = splitted.length > 5 && splitted[5] === 'amount';

                            // Option menu
                            return [
                                {
                                    id: `groups.${groupId}.${recordName}.${menuId}.${optionId}${returnAmount ? '.amount' : ''}`,
                                    name: $t(`%wO`),
                                    width: 30,
                                    getValue: (member: PlatformMember) => {
                                        const registration = getRegistration(member);
                                        if (!registration) {
                                            return {
                                                value: '',
                                            };
                                        }
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
                                },
                            ];
                        }

                        // Option menu
                        return [
                            {
                                id: `groups.${groupId}.${recordName}.${menuId}`,
                                name: $t(`%Tb`),
                                width: 30,
                                getValue: (member: PlatformMember) => {
                                    const registration = getRegistration(member);
                                    if (!registration) {
                                        return {
                                            value: '',
                                        };
                                    }
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
                    }

                    if (recordName === 'recordAnswers') {
                        if (splitted.length < 4) {
                            return;
                        }

                        const recordId = splitted[3];
                        return [
                            {
                                id: `groups.${groupId}.${recordName}.${recordId}`,
                                name: 'Vraag',
                                width: 35,
                                getValue: (member: PlatformMember) => {
                                    const registration = getRegistration(member);
                                    if (!registration) {
                                        return {
                                            value: '',
                                        };
                                    }

                                    return {
                                        value: registration.recordAnswers.get(recordId)?.excelValues[0]?.value ?? '',
                                    };
                                },
                            },
                        ];
                    }

                    return;
                }
            },
        },
    ],
};

ExportToExcelEndpoint.loaders.set(ExcelExportType.Members, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetMembersEndpoint.buildData(query);

        return new UnencodeablePaginatedResponse({
            results: PlatformFamily.createSingles(result.results, {
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

function formatGender(gender: Gender): string {
    switch (gender) {
        case Gender.Male: return $t(`%XK`);
        case Gender.Female: return $t(`%XM`);
        default: return $t(`%1JG`);
    }
}

function formatMembershipStatus(status: MembershipStatus): string {
    switch (status) {
        case MembershipStatus.Trial:
            return $t(`%1IH`);
        case MembershipStatus.Active:
            return $t(`%1H0`);
        case MembershipStatus.Expiring:
            return $t(`%7F`);
        case MembershipStatus.Temporary:
            return $t(`%zU`);
        case MembershipStatus.Inactive:
            return $t(`%zV`);
    }
}
