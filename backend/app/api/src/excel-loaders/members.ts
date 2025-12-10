import { XlsxBuiltInNumberFormat, XlsxTransformerColumn, XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { Platform } from '@stamhoofd/models';
import { ExcelExportType, Gender, GroupType, LimitedFilteredRequest, PlatformFamily, PlatformMember, Platform as PlatformStruct, UnencodeablePaginatedResponse } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { GetMembersEndpoint } from '../endpoints/global/members/GetMembersEndpoint.js';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures.js';
import { Context } from '../helpers/Context.js';
import { XlsxTransformerColumnHelper } from '../helpers/XlsxTransformerColumnHelper.js';

export const baseMemberColumns: XlsxTransformerColumn<PlatformMember>[] = [
    {
        id: 'id',
        name: $t(`29360811-3663-496c-8d8f-c9fdf9467a74`),
        width: 40,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.id,
        }),
    },
    {
        id: 'memberNumber',
        name: $t(`cc1cf4a7-0bd2-4fa7-8ff2-0a12470a738d`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.memberNumber,
        }),
    },
    {
        id: 'firstName',
        name: $t(`efca0579-0543-4636-a996-384bc9f0527e`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.firstName,
        }),
    },
    {
        id: 'lastName',
        name: $t(`4a5e438e-08a1-411e-9b66-410eea7ded73`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.lastName,
        }),
    },
    {
        id: 'birthDay',
        name: $t(`7d7b5a21-105a-41a1-b511-8639b59024a4`),
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
        name: $t(`992b79e9-8c6e-4096-aa59-9e5f546eac41`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.age,
        }),
    },
    {
        id: 'gender',
        name: $t(`a39908e8-62b0-487c-9a03-57dd62326d94`),
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
        name: $t(`856aaa1c-bc62-4e45-9ae5-4c7e7dca23ab`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.phone,
        }),
    },
    {
        id: 'email',
        name: $t(`82f4b6ed-afee-4655-9f07-22802e0e7ad9`),
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
        name: $t(`0fa4253f-1cfd-4394-93b4-dfba8da04738`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.securityCode,
        }),
    },
    {
        id: 'uitpasNumber',
        name: $t(`87c1a48c-fef5-44c3-ae56-c83463fcfb84`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.uitpasNumber,
        }),
    },
    {
        id: 'requiresFinancialSupport',
        // todo: use correct term
        name: $t(`030be384-9014-410c-87ba-e04920c26111`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: XlsxTransformerColumnHelper.formatBoolean(object.details.requiresFinancialSupport?.value),
        }),
    },
    {
        id: 'notes',
        name: $t(`8c38d163-c01b-488f-8729-11de8af7d098`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.notes,
        }),
    },
    {
        id: 'nationalRegisterNumber',
        name: $t(`00881b27-7501-4c56-98de-55618be2bf11`),
        width: 30,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.nationalRegisterNumber?.toString() ?? '',
        }),
    },

    ...XlsxTransformerColumnHelper.creatColumnsForParents(),

    // unverified data
    {
        id: 'unverifiedPhones',
        name: $t(`506a2bd8-bd5b-48ae-8480-fbb9e9faa683`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.unverifiedPhones.join(', '),
        }),
    },
    {
        id: 'unverifiedEmails',
        name: $t(`62b19231-9770-4553-ad25-500df57ccf84`),
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
        name: $t(`b45f1017-e859-43da-8829-a21639a9e70d`),
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
    name: $t(`fb35c140-e936-4e91-aa92-ef4dfc59fb51`),
    columns: [
        ...baseMemberColumns,
        {
            id: 'organization',
            name: $t(`afd7843d-f355-445b-a158-ddacf469a5b1`),
            width: 40,
            getValue: (member: PlatformMember) => {
                const organizations = member.filterOrganizations({ currentPeriod: true, types: [GroupType.Membership] });
                const str = Formatter.joinLast(organizations.map(o => o.name).sort(), ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') || Context.i18n.$t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                return {
                    value: str,
                };
            },
        },
        {
            id: 'uri',
            name: $t(`27cfaf26-6b88-4ebc-a50a-627a9f0f9e64`),
            width: 30,
            getValue: (member: PlatformMember) => {
                const organizations = member.filterOrganizations({ currentPeriod: true, types: [GroupType.Membership] });
                const str = Formatter.joinLast(organizations.map(o => o.uri).sort(), ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') || Context.i18n.$t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                return {
                    value: str,
                };
            },
        },
        {
            id: 'group',
            name: $t(`0c230001-c3be-4a8e-8eab-23dc3fd96e52`),
            width: 40,
            getValue: (member: PlatformMember) => {
                const groups = member.filterRegistrations({ currentPeriod: true, types: [GroupType.Membership], organizationId: Context.organization?.id });
                const str = Formatter.joinLast(Formatter.uniqueArray(groups.map(o => o.group.settings.name.toString())).sort(), ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') || Context.i18n.$t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                return {
                    value: str,
                };
            },
        },
        {
            id: 'defaultAgeGroup',
            name: $t(`0ef2bbb3-0b3c-411a-8901-a454cff1f839`),
            width: 40,
            getValue: (member: PlatformMember) => {
                const groups = member.filterRegistrations({ currentPeriod: true, types: [GroupType.Membership], organizationId: Context.organization?.id });
                const defaultAgeGroupIds = Formatter.uniqueArray(groups.filter(o => o.group.defaultAgeGroupId));
                const defaultAgeGroups = defaultAgeGroupIds.map(o => PlatformStruct.shared.config.defaultAgeGroups.find(g => g.id === o.group.defaultAgeGroupId)?.name ?? $t(`6aeee253-beb2-4548-b60e-30836afcf2f0`));
                const str = Formatter.joinLast(Formatter.uniqueArray(defaultAgeGroups).sort(), ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') || Context.i18n.$t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                return {
                    value: str,
                };
            },
        },
        {
            id: 'outstandingBalance',
            name: $t(`beb45452-dee7-4a7f-956c-e6db06aac20f`),
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
                                name: $t(`dcc53f25-f0e9-4e3e-9f4f-e8cfa4e88755`),
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
                                    name: $t(`d89d7fcd-ecf3-40a2-afb6-f51c3f6c9bc6`),
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
                                name: $t(`99e37a95-6a68-4921-a8db-08fb136f87dd`),
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

function formatGender(gender: Gender) {
    switch (gender) {
        case Gender.Male: return $t(`f972abd4-de1e-484b-b7da-ad4c75d37808`);
        case Gender.Female: return $t(`e21f499d-1078-4044-be5d-6693d2636699`);
        default: return $t(`60f13ba4-c6c9-4388-9add-43a996bf6bee`);
    }
}
