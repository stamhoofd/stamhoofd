import { ArrayDecoder, field } from '@simonbackx/simple-encoding';
import { XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { Group, Member, MemberResponsibilityRecord } from '@stamhoofd/models';
import { ExcelExportType, LimitedFilteredRequest, MemberResponsibilityRecord as MemberResponsibilityRecordStruct, MemberWithRegistrationsBlob, Organization as OrganizationStruct, PaginatedResponse, Platform as PlatformStruct, Premise } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { GetOrganizationsEndpoint } from '../endpoints/admin/organizations/GetOrganizationsEndpoint.js';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures.js';
import { XlsxTransformerColumnHelper } from '../helpers/XlsxTransformerColumnHelper.js';

class MemberResponsibilityRecordWithMember extends MemberResponsibilityRecordStruct {
    @field({ decoder: MemberWithRegistrationsBlob })
    member: MemberWithRegistrationsBlob;
}

class OrganizationWithResponsibilities extends OrganizationStruct {
    @field({ decoder: new ArrayDecoder(MemberResponsibilityRecordWithMember) })
    responsibilities: MemberResponsibilityRecordWithMember[];
}

class MemberResponsibilityRecordWithMemberAndOrganization extends MemberResponsibilityRecordWithMember {
    @field({ decoder: OrganizationWithResponsibilities })
    organization: OrganizationWithResponsibilities;
}

type Object = OrganizationWithResponsibilities;

// Assign to a typed variable to assure we have correct type checking in place
const sheet: XlsxTransformerSheet<Object, Object> = {
    id: 'organizations',
    name: $t(`2a033cd8-b9e4-4a92-a8a6-b4a687d87e79`),
    columns: [
        {
            id: 'id',
            name: $t(`29360811-3663-496c-8d8f-c9fdf9467a74`),
            width: 40,
            getValue: (object: Object) => ({
                value: object.id,
            }),
        },
        {
            id: 'uri',
            name: $t(`27cfaf26-6b88-4ebc-a50a-627a9f0f9e64`),
            width: 20,
            getValue: (object: Object) => ({
                value: object.uri,
            }),
        },
        {
            id: 'name',
            name: $t(`522fb6c5-6d4d-4d9c-94b7-3e282fb0ea1f`),
            width: 50,
            getValue: (object: Object) => ({
                value: object.name,
            }),
        },
        {
            id: 'tags',
            name: $t(`5f8c1ac5-a650-4046-80b6-0fe37fa12439`),
            width: 50,
            getValue: (object: Object) => {
                const platform = PlatformStruct.shared;

                return {
                    value: object.meta.tags.map(tag => platform.config.tags.find(t => t.id === tag)?.name ?? $t(`bd1e59c8-3d4c-4097-ab35-0ce7b20d0e50`)).join(', '),
                };
            },
        },
        XlsxTransformerColumnHelper.createAddressColumns<OrganizationStruct>({
            matchId: 'address',
            getAddress: object => object.address,
        }),
        // Dynamic records
        XlsxTransformerColumnHelper.createRecordAnswersColumns({
            matchId: 'recordAnswers',
            getRecordAnswers: (object: Object) => object.getRecordAnswers(),
            getRecordCategories: () => {
                const platform = PlatformStruct.shared;

                return [
                    ...platform.config.organizationLevelRecordsConfiguration.recordCategories,
                ];
            },
        }),
    ],
};

const responsibilities: XlsxTransformerSheet<Object, MemberResponsibilityRecordWithMemberAndOrganization> = {
    id: 'responsibilities',
    name: $t(`d0defb77-0a25-4b85-a03e-57569c5edf6c`),
    transform(organization) {
        return organization.responsibilities.map(r => MemberResponsibilityRecordWithMemberAndOrganization.create({
            ...r,
            organization,
        }));
    },
    columns: [
        {
            id: 'organization.id',
            name: $t(`29360811-3663-496c-8d8f-c9fdf9467a74`),
            width: 35,
            getValue: (object: MemberResponsibilityRecordWithMemberAndOrganization) => ({
                value: object.organization.id,
            }),
        },
        {
            id: 'organization.uri',
            name: $t(`27cfaf26-6b88-4ebc-a50a-627a9f0f9e64`),
            width: 20,
            getValue: (object: MemberResponsibilityRecordWithMemberAndOrganization) => ({
                value: object.organization.uri,
            }),
        },
        {
            id: 'organization.name',
            name: $t(`c14b0320-cb84-4386-a39a-aa9ffb5eb886`),
            width: 50,
            getValue: (object: MemberResponsibilityRecordWithMemberAndOrganization) => ({
                value: object.organization.name,
            }),
        },
        {
            id: 'responsibility.name',
            name: $t(`d6fb6973-92f7-4d39-beeb-0f324c0fe865`),
            width: 50,
            getValue: (object: MemberResponsibilityRecordWithMemberAndOrganization) => {
                const platform = PlatformStruct.shared;
                const responsibility = platform.config.responsibilities.find(r => r.id === object.responsibilityId) ?? object.organization.privateMeta?.responsibilities.find(r => r.id === object.responsibilityId);

                if (!responsibility) {
                    return {
                        value: $t(`2b1d05e5-6a0a-49d5-8510-8593eda94470`),
                    };
                }

                return {
                    value: responsibility.name + (responsibility.isGroupBased ? ' ' + $t(`9ddd7aba-9426-4718-9eb0-673b615efcf4`) + ' ' + (object.group?.settings.name ?? $t(`eb6d556a-bcda-4ab4-ad39-3215b4734569`)) : ''),
                };
            },
        },
        {
            id: 'responsibility.member.firstName',
            name: $t(`efca0579-0543-4636-a996-384bc9f0527e`),
            width: 30,
            getValue: (object: MemberResponsibilityRecordWithMemberAndOrganization) => ({
                value: object.member.firstName,
            }),
        },
        {
            id: 'responsibility.member.lastName',
            name: $t(`4a5e438e-08a1-411e-9b66-410eea7ded73`),
            width: 30,
            getValue: (object: MemberResponsibilityRecordWithMemberAndOrganization) => ({
                value: object.member.details.lastName,
            }),
        },
        {
            id: 'responsibility.member.email',
            name: $t(`a1b06e74-f581-4ea0-9e86-83f0c963fd4f`),
            width: 50,
            getValue: (object: MemberResponsibilityRecordWithMemberAndOrganization) => ({
                value: object.member.details.email,
            }),
        },
        XlsxTransformerColumnHelper.createAddressColumns<MemberResponsibilityRecordWithMemberAndOrganization>({
            matchId: 'responsibility.member.address',
            getAddress: object => object.member.details.address ?? object.member.details.parents[0]?.address ?? object.member.details.parents[1]?.address ?? null,
        }),
    ],
};

type PremiseWithOrganization = { organization: Object; premise: Premise };
const premises: XlsxTransformerSheet<Object, PremiseWithOrganization> = {
    id: 'premises',
    name: $t(`9fe916f3-199d-4be2-b9c2-c96eeea31437`),
    transform(organization) {
        return organization.privateMeta?.premises.map(r => ({
            organization,
            premise: r,
        })) ?? [];
    },
    columns: [
        {
            id: 'organization.id',
            name: $t(`29360811-3663-496c-8d8f-c9fdf9467a74`),
            width: 35,
            getValue: (object: PremiseWithOrganization) => ({
                value: object.organization.id,
            }),
        },
        {
            id: 'organization.uri',
            name: $t(`27cfaf26-6b88-4ebc-a50a-627a9f0f9e64`),
            width: 20,
            getValue: (object: PremiseWithOrganization) => ({
                value: object.organization.uri,
            }),
        },
        {
            id: 'organization.name',
            name: $t(`c14b0320-cb84-4386-a39a-aa9ffb5eb886`),
            width: 50,
            getValue: (object: PremiseWithOrganization) => ({
                value: object.organization.name,
            }),
        },
        {
            id: 'premise.name',
            name: $t(`522fb6c5-6d4d-4d9c-94b7-3e282fb0ea1f`),
            width: 20,
            getValue: (object: PremiseWithOrganization) => ({
                value: object.premise.name,
            }),
        },
        {
            id: 'premise.type',
            name: $t(`f97ad8c1-31d2-4b61-9e09-3be86eaeba08`),
            width: 20,
            getValue: (object: PremiseWithOrganization) => {
                const ids = object.premise.premiseTypeIds;
                const platform = PlatformStruct.shared;
                return {
                    value: ids.map(id => platform.config.premiseTypes.find(t => t.id === id)?.name ?? $t(`bd1e59c8-3d4c-4097-ab35-0ce7b20d0e50`)).join(', '),
                };
            },
        },
        XlsxTransformerColumnHelper.createAddressColumns<PremiseWithOrganization>({
            matchId: 'premise.address',
            getAddress: object => object.premise.address,
        }),
    ],
};

ExportToExcelEndpoint.loaders.set(ExcelExportType.Organizations, {
    fetch: async (query: LimitedFilteredRequest) => {
        const organizations = await GetOrganizationsEndpoint.buildData(query);

        // Now load all responsibilities with members with an active responsibility for theses organizations
        const organizationIds = organizations.results.map(o => o.id);
        const responsibilities = organizationIds.length
            ? await MemberResponsibilityRecord.select()
                .where('organizationId', organizationIds)
                .where('endDate', null)
                .fetch()
            : [];

        // Load groups and members
        const groupIds = Formatter.uniqueArray(responsibilities.map(o => o.groupId).filter(g => g !== null));
        const memberIds = Formatter.uniqueArray(responsibilities.map(o => o.memberId).filter(m => m !== null));

        const members = await Member.getBlobByIds(...memberIds);
        const groups = await Group.getByIDs(...groupIds);
        const memberStructs = await AuthenticatedStructures.members(members);
        const groupStructs = await AuthenticatedStructures.groups(groups);
        const platform = PlatformStruct.shared;

        const mappedOrganizations = organizations.results.map((o) => {
            const resp = responsibilities.filter(r => r.organizationId === o.id);

            const mappedResponsibilities = resp.map((r) => {
                const member = memberStructs.find(m => m.id === r.memberId);
                const group = groupStructs.find(g => g.id === r.groupId);

                return MemberResponsibilityRecordWithMember.create({
                    ...r,
                    member: member,
                    group: group ? group : null,
                });
            });

            // Sort responsibilites by index in platform config
            // and, if the same, sort by order of default age group id if it has a group
            mappedResponsibilities.sort((a, b) => {
                const aIndex = platform.config.responsibilities.findIndex(r => r.id === a.responsibilityId);
                const bIndex = platform.config.responsibilities.findIndex(r => r.id === b.responsibilityId);

                const groupAIndex = platform.config.defaultAgeGroups.findIndex(g => g.id === a.group?.defaultAgeGroupId);
                const groupBIndex = platform.config.defaultAgeGroups.findIndex(g => g.id === b.group?.defaultAgeGroupId);

                return Sorter.stack(
                    aIndex - bIndex,
                    groupAIndex - groupBIndex,
                );
            });

            return OrganizationWithResponsibilities.create({
                ...o,
                responsibilities: mappedResponsibilities,
            });
        });

        return new PaginatedResponse({
            results: mappedOrganizations,
            next: organizations.next,
        });
    },
    sheets: [
        sheet,
        responsibilities,
        premises,
    ],
});
