import {
    Gender,
    GroupType,
    Platform,
    PlatformMember,
} from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ExportItemHelper } from '../helpers/ExportItemHelper';
import { ExportDictionary } from './ExportDictionary';

// todo: replace
function formatGender(gender: Gender) {
    switch (gender) {
        case Gender.Male:
            return $t(`f972abd4-de1e-484b-b7da-ad4c75d37808`);
        case Gender.Female:
            return $t(`e21f499d-1078-4044-be5d-6693d2636699`);
        default:
            return $t(`60f13ba4-c6c9-4388-9add-43a996bf6bee`);
    }
}

export class MembersExportDictionary extends ExportDictionary<PlatformMember> {
    private readonly getOrganizationId: () => string | undefined;

    constructor({ getOrganizationId }: { getOrganizationId: () => string | undefined }) {
        super();
        this.getOrganizationId = getOrganizationId;
    }

    concreteDictionary = {
        memberNumber: {
            name: $t(`cc1cf4a7-0bd2-4fa7-8ff2-0a12470a738d`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.memberNumber,
        },
        firstName: {
            name: $t(`efca0579-0543-4636-a996-384bc9f0527e`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.firstName,
        },
        lastName: {
            name: $t(`4a5e438e-08a1-411e-9b66-410eea7ded73`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.lastName,
        },
        birthDay: {
            name: $t(`7d7b5a21-105a-41a1-b511-8639b59024a4`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.birthDay,
        },
        age: {
            name: $t(`992b79e9-8c6e-4096-aa59-9e5f546eac41`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.age,
        },
        gender: {
            name: $t(`a39908e8-62b0-487c-9a03-57dd62326d94`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                formatGender(object.details.gender),
        },
        phone: {
            name: $t(`856aaa1c-bc62-4e45-9ae5-4c7e7dca23ab`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.phone,
        },
        email: {
            name: $t(`82f4b6ed-afee-4655-9f07-22802e0e7ad9`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.email,
        },
        securityCode: {
            name: $t(`0fa4253f-1cfd-4394-93b4-dfba8da04738`),
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.securityCode,
        },
        uitpasNumber: {
            name: $t(`87c1a48c-fef5-44c3-ae56-c83463fcfb84`),
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.uitpasNumber,
        },
        requiresFinancialSupport: {
            // todo: use correct term
            name: $t(`030be384-9014-410c-87ba-e04920c26111`),
            // todo!!!!!!!!!!!!
            getValue: ({ patchedMember: object }: PlatformMember) => false.toString(),
            // ({
            //     // todo!!!
            //     value: false,
            //     // value: XlsxTransformerColumnHelper.formatBoolean(
            //     //     object.details.requiresFinancialSupport?.value,
            //     // ),
            // }),
        },
        notes: {
            name: $t(`8c38d163-c01b-488f-8729-11de8af7d098`),
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.notes,
        },
        organization: {
            name: $t(`afd7843d-f355-445b-a158-ddacf469a5b1`),
            getValue: (member: PlatformMember) => {
                const organizations = member.filterOrganizations({
                    currentPeriod: true,
                    types: [GroupType.Membership],
                });
                const str
                    = Formatter.joinLast(
                        organizations.map(o => o.name).sort(),
                        ', ',
                        ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ',
                    )
                    || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                return str;
            },
        },
        uri: {
            name: $t(`27cfaf26-6b88-4ebc-a50a-627a9f0f9e64`),
            getValue: (member: PlatformMember) => {
                const organizations = member.filterOrganizations({
                    currentPeriod: true,
                    types: [GroupType.Membership],
                });
                const str
                    = Formatter.joinLast(
                        organizations.map(o => o.uri).sort(),
                        ', ',
                        ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ',
                    )
                    || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                return str;
            },
        },
        group: {
            name: $t(`0c230001-c3be-4a8e-8eab-23dc3fd96e52`),
            getValue: (member: PlatformMember) => {
                const groups = member.filterRegistrations({
                    currentPeriod: true,
                    types: [GroupType.Membership],
                    organizationId: this.getOrganizationId(),
                });
                const str
                    = Formatter.joinLast(
                        Formatter.uniqueArray(
                            groups.map(o => o.group.settings.name.toString()),
                        ).sort(),
                        ', ',
                        ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ',
                    )
                    || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                return str;
            },
        },
        defaultAgeGroup: {
            name: $t(`0ef2bbb3-0b3c-411a-8901-a454cff1f839`),
            getValue: (member: PlatformMember) => {
                const groups = member.filterRegistrations({
                    currentPeriod: true,
                    types: [GroupType.Membership],
                    organizationId: this.getOrganizationId(),
                });
                const defaultAgeGroupIds = Formatter.uniqueArray(
                    groups.filter(o => o.group.defaultAgeGroupId),
                );
                const defaultAgeGroups = defaultAgeGroupIds.map(
                    o =>
                        Platform.shared.config.defaultAgeGroups.find(
                            g => g.id === o.group.defaultAgeGroupId,
                        )?.name ?? $t(`6aeee253-beb2-4548-b60e-30836afcf2f0`),
                );
                const str
                    = Formatter.joinLast(
                        Formatter.uniqueArray(defaultAgeGroups).sort(),
                        ', ',
                        ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ',
                    )
                    || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                return str;
            },
        },
        nationalRegisterNumber: {
            name: $t(`00881b27-7501-4c56-98de-55618be2bf11`),
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.nationalRegisterNumber?.toString() ?? '',
        },
        unverifiedPhones: {
            name: $t(`506a2bd8-bd5b-48ae-8480-fbb9e9faa683`),
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.unverifiedPhones.join(', '),
        },
        unverifiedEmails: {
            name: $t(`62b19231-9770-4553-ad25-500df57ccf84`),
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.unverifiedEmails.join(', '),
        },
        unverifiedAddresses: {
            name: $t(`b45f1017-e859-43da-8829-a21639a9e70d`),
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.unverifiedAddresses.map(a => a.toString()).join('; '),
        },
        ...ExportItemHelper.creatExportItemsForParents(),
    };

    matchDictionary = {
        'address': ExportItemHelper.createAddressMatchItems({
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
        'parent.address': ExportItemHelper.createAddressMatchItemsForParents(),
        'unverifiedAddresses': ExportItemHelper.createMultipleAddressMatchItems({
            matchIdStart: 'unverifiedAddresses',
            getAddresses: (object: PlatformMember) => object.patchedMember.details.unverifiedAddresses,
            limit: 2,
        }),
    };
}
