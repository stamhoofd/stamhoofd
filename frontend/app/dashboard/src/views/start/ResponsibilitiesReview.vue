<template>
    <LoadingViewTransition>
        <ReviewSetupStepView v-if="!$isLoading" :type="SetupStepType.Responsibilities">
            <template #top>
                <p>{{ $t('209f9f13-4897-4310-95eb-f436987b8ba7') }}</p>
            </template>

            <p v-if="!$organizationBasedResponsibilities.length" class="info-box">
                {{ $t('Er zijn geen ingebouwde functies.') }}
            </p>

            <div v-if="$rowCategories" class="container">
                <div v-if="$rowCategories.requiredRows.length" class="container">
                    <hr><h2>{{ $t('Verplichte functies') }}</h2>
                    <STList class="info">
                        <ResponsibilityReview v-for="row in $rowCategories.requiredRows" :key="row.responsibility.id" :responsibility="row.responsibility" :group="row.group" :members="row.members" :count="row.count" :progress="row.progress" :total="row.total" />
                    </STList>
                </div>

                <div v-if="$rowCategories.optionalRows.length" class="container">
                    <hr><h2>{{ $t('Optionele functies') }}</h2>
                    <STList class="info">
                        <ResponsibilityReview v-for="row in $rowCategories.optionalRows" :key="row.responsibility.id" :responsibility="row.responsibility" :group="row.group" :members="row.members" :count="row.count" :progress="row.progress" :total="row.total" />
                    </STList>
                </div>
            </div>
        </ReviewSetupStepView>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { LoadingViewTransition, useAuth, useContext, useOrganization, usePlatform, useVisibilityChange } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { Group, LimitedFilteredRequest, MemberResponsibility, MembersBlob, Organization, PaginatedResponseDecoder, PlatformFamily, PlatformMember, SetupStepType, SortItemDirection } from '@stamhoofd/structures';
import { computed, onMounted, Ref, ref } from 'vue';
import ResponsibilityReview from './ResponsibilityReview.vue';
import ReviewSetupStepView from './ReviewSetupStepView.vue';

type RowData = {
    responsibility: MemberResponsibility;
    group: Group | null;
    members: PlatformMember[];
    count?: number;
    progress?: number;
    total?: number;
};

const $organization = useOrganization();
const $platform = usePlatform();
const $context = useContext();
const owner = useRequestOwner();
const auth = useAuth();

const $allMembers = ref(null) as Ref<PlatformMember[] | null>;

const $organizationBasedResponsibilities = computed(() => $platform.value.config.responsibilities.filter(r => r.organizationBased));

const $groups = computed(() => {
    const organization = $organization.value;
    if (!organization) return [];
    return organization.period.getCategoryTree({
        permissions: auth.permissions,
        organization,
        maxDepth: 1,
        smartCombine: true,
    }).getAllGroups();
});

const $allRows = computed(() => {
    const organization = $organization.value;
    if (!organization) return null;

    const allMembers = $allMembers.value;
    if (allMembers === null) return null;

    const groups = $groups.value;

    const responsibilities = $organizationBasedResponsibilities.value;
    return responsibilities
        .flatMap(r => getRowData(r, allMembers, organization, groups))
        .sort((a, b) => getPriority(b) - getPriority(a));
});

const $rowCategories = computed(() => {
    if ($allRows.value === null) {
        return null;
    }

    const requiredRows: RowData[] = [];
    const optionalRows: RowData[] = [];

    for (const row of $allRows.value) {
        const responsibility = row.responsibility;
        const minimumMembers = responsibility.minimumMembers;
        const isRequired = !!minimumMembers;

        if (isRequired) {
            requiredRows.push(row);
        }
        else {
            optionalRows.push(row);
        }
    }

    return {
        requiredRows,
        optionalRows,
    };
});

const $isLoading = computed(() => $rowCategories.value === null);

onMounted(async () => {
    await fetchMembers();
});

useVisibilityChange(async () => {
    await fetchMembers();
});

async function fetchMembers() {
    const responsibilities = $organizationBasedResponsibilities.value;
    $allMembers.value = await getAllMembersWithResponsibilities(responsibilities);
}

async function getAllMembersWithResponsibilities(responsibilities: MemberResponsibility[]): Promise<PlatformMember[]> {
    const organization = $organization.value;

    if (!organization) return [];

    const responsibilityIds = responsibilities.map(r => r.id);

    if (!responsibilityIds.length) return [];

    const query = new LimitedFilteredRequest({
        filter: {
            registrations: {
                $elemMatch: {
                    organizationId: organization.id,
                    periodId: organization.period.period.id,
                },
            },
            responsibilities: {
                $elemMatch: {
                    organizationId: organization.id,
                    responsibilityId: {
                        $in: responsibilityIds,
                    },
                    $and: [
                        {
                            $or: [{
                                endDate: {
                                    $gt: { $: '$now' },
                                },
                            }, { endDate: { $eq: null } }],
                        },
                    ],
                },
            },
        },
        sort: [
            { key: 'firstName', order: SortItemDirection.ASC },
            { key: 'lastName', order: SortItemDirection.ASC },
            { key: 'id', order: SortItemDirection.ASC },
        ],
        // todo: change limit? or get all?
        limit: 100,
    });

    const response = await $context.value.authenticatedServer.request({
        method: 'GET',
        path: '/members',
        decoder: new PaginatedResponseDecoder(MembersBlob as Decoder<MembersBlob>, LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
        query,
        shouldRetry: false,
        owner,
    });

    const blob = response.data.results;

    const results: PlatformMember[] = PlatformFamily.createSingles(blob, {
        contextOrganization: $context.value.organization,
        platform: $platform.value,
    });

    return results;
}

function getRowData(responsibility: MemberResponsibility, allMembersWithResponsibilities: PlatformMember[], organization: Organization, allGroups: Group[]): RowData[] {
    return getRowDataWithoutProgress(responsibility, allMembersWithResponsibilities, organization, allGroups)
        .map((row) => {
            return {
                ...row,
                ...getProgress(row.responsibility, row.members),
            };
        });
}

function getPriority(row: RowData) {
    if (row.count === 0) return 0;
    if (row.count !== undefined) return 1;
    return 2;
}

function getRowDataWithoutProgress(responsibility: MemberResponsibility, allMembersWithResponsibilities: PlatformMember[], organization: Organization, allGroups: Group[]): Omit<RowData, 'progress'>[] {
    const responsibilityId = responsibility.id;
    const organizationId = organization.id;
    // todo: how to be sure this date is the same as the backend?
    const now = new Date();

    const defaultAgeGroupIds = responsibility.defaultAgeGroupIds;

    if (defaultAgeGroupIds !== null) {
        const rows: Omit<RowData, 'progress'>[] = [];

        const includedGroups = defaultAgeGroupIds.flatMap(id => allGroups.filter(g => g.defaultAgeGroupId === id));

        for (const group of includedGroups) {
            const groupId = group.id;

            const members = allMembersWithResponsibilities.filter(platformMember => platformMember.member.responsibilities
                .some(r => r.responsibilityId === responsibilityId
                    && r.organizationId === organizationId
                    && r.groupId === groupId
                    && (r.endDate === null || r.endDate > now),
                ),
            );

            rows.push({
                responsibility,
                members,
                group,
            });
        }

        return rows;
    }

    const members = allMembersWithResponsibilities.filter(platformMember => platformMember.member.responsibilities
        .some(r => r.responsibilityId === responsibilityId
            && r.organizationId === organizationId
            && (r.endDate === null || r.endDate > now),
        ),
    );

    return [{
        responsibility,
        members,
        group: null,
    }];
}

function getProgress(responsibility: MemberResponsibility, members: PlatformMember[]): { count?: number; progress?: number; total?: number } {
    const { minimumMembers, maximumMembers } = responsibility;

    if (minimumMembers === null && maximumMembers === null) {
        return { count: members.length };
    }

    const count = members.length;
    let total: number | null = null;

    // count will be lower
    if (minimumMembers !== null && count < minimumMembers) {
        total = minimumMembers;
    }

    // count will exceed
    else if (maximumMembers !== null && count > maximumMembers) {
        total = maximumMembers;
    }
    else {
        // other cases: show only count
        return { count };
    }

    if (total === 0) return { progress: 1, total };
    return { progress: count / total, total };
}
</script>
