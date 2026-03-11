import { XlsxBuiltInNumberFormat, XlsxTransformerColumn, XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { Platform } from '@stamhoofd/models';
import { ExcelExportType, Gender, GroupType, LimitedFilteredRequest, MembershipStatus, PlatformFamily, PlatformMember, Platform as PlatformStruct, UnencodeablePaginatedResponse } from '@stamhoofd/structures';
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
        name: $t(`89eafa94-6447-4608-a71e-84752eab10c8`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.memberNumber,
        }),
    },
    {
        id: 'firstName',
        name: $t(`603606c2-95ca-4967-814c-53ec3297bf33`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.firstName,
        }),
    },
    {
        id: 'lastName',
        name: $t(`033780e9-417d-4f0a-9aba-7ddfdf655d22`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.lastName,
        }),
    },
    {
        id: 'birthDay',
        name: $t(`00650ac3-eb78-4c8b-b7ec-d892772837a1`),
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
        name: $t(`8c1f264f-3b0b-49b9-8a29-9ceb2dfd7754`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: object.details.age,
        }),
    },
    {
        id: 'gender',
        name: $t(`08ef39ff-3431-4975-8c46-8fb68c946432`),
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
        name: $t(`237d0720-13f0-4029-8bf2-4de7e0a9a358`),
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
            value: object.details.uitpasNumberDetails?.uitpasNumber ?? null,
        }),
    },
    {
        id: 'requiresFinancialSupport',
        // todo: use correct term
        name: $t(`030be384-9014-410c-87ba-e04920c26111`),
        width: 20,
        getValue: ({ patchedMember: object }: PlatformMember) => ({
            value: XlsxTransformerColumnHelper.formatBoolean(object.details.hasFinancialSupportOrActiveUitpas),
        }),
    },
    {
        id: 'notes',
        name: $t(`7f3af27c-f057-4ce3-8385-36dfb99745e8`),
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
    {
        id: 'membership',
        name: $t(`c0277e8e-a2e0-4ec3-9339-c2e1be2e6e2d`),
        width: 20,
        getValue: (member: PlatformMember) => {
            return {
                value: formatMembershipStatus(member.membershipStatus),
            };
        },
    },
    {
        id: 'organization',
        name: $t(`afd7843d-f355-445b-a158-ddacf469a5b1`),
        width: 40,
        getValue: (member: PlatformMember) => {
            const organizations = member.filterOrganizations({ currentPeriod: true, types: [GroupType.Membership] });
            const str = Formatter.joinLast(organizations.map(o => o.name).sort(), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ') || Context.i18n.$t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

            return {
                value: str,
            };
        },
    },
    {
        id: 'uri',
        name: $t(`05723781-9357-41b2-9fb8-cb4f80dde7f9`),
        width: 30,
        getValue: (member: PlatformMember) => {
            const organizations = member.filterOrganizations({ currentPeriod: true, types: [GroupType.Membership] });
            const str = Formatter.joinLast(organizations.map(o => o.uri).sort(), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ') || Context.i18n.$t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

            return {
                value: str,
            };
        },
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
    name: $t(`19da8d23-acea-43c2-bfdd-742447ca57f1`),
    columns: [
        ...baseMemberColumns,
        {
            id: 'group',
            name: $t(`0c230001-c3be-4a8e-8eab-23dc3fd96e52`),
            width: 40,
            getValue: (member: PlatformMember) => {
                const groups = member.filterRegistrations({ currentPeriod: true, types: [GroupType.Membership], organizationId: Context.organization?.id });
                const str = Formatter.joinLast(Formatter.uniqueArray(groups.map(o => o.group.settings.name.toString())).sort(), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ') || Context.i18n.$t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

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
                const str = Formatter.joinLast(Formatter.uniqueArray(defaultAgeGroups).sort(), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ') || Context.i18n.$t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                return {
                    value: str,
                };
            },
        },
        {
            id: 'outstandingBalance',
            name: $t(`28c2bc66-231f-44f3-9249-c1981b871a1f`),
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
            name: $t('6711ac76-e8c7-482b-b6b4-635ba3d16f60'),
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
                                name: $t(`a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc`),
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
                                name: $t(`792ebf47-4ad3-4d9c-a4ab-f315b715e70e`),
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
        case Gender.Male: return $t(`b54b9706-4c0c-46a6-9027-37052eb76b28`);
        case Gender.Female: return $t(`06466432-eca6-41d0-a3d6-f262f8d6d2ac`);
        default: return $t(`26677608-996f-41a5-8a53-543d6efa7de4`);
    }
}

function formatMembershipStatus(status: MembershipStatus): string {
    switch (status) {
        case MembershipStatus.Trial:
            return $t(`1f2e9d09-717b-4c17-9bbe-dce3f3dcbff0`);
        case MembershipStatus.Active:
            return $t(`079afc7a-6ccb-4c7f-b739-24198b0cfec2`);
        case MembershipStatus.Expiring:
            return $t(`cc528c3f-aed3-4eb6-9db1-70aae5261a28`);
        case MembershipStatus.Temporary:
            return $t(`75e62d3c-f348-4104-8a1e-e11e6e7fbe32`);
        case MembershipStatus.Inactive:
            return $t(`1f8620fa-e8a5-4665-99c8-c1907a5b5768`);
    }
}
