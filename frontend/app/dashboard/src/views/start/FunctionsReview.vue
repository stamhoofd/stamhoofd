<template>
    <ReviewSetupStepView :type="SetupStepType.Functions" :step="step">
        <template #top>
            <p>Kijk hieronder na of alle functies toegekend zijn. Om een functie toe te kennen ga je naar het tabblad "Leden". Daar kan je met de rechtermuisknop op een lid klikken en "Functies bewerken" kiezen. </p>
        </template>

        <p v-if="!organizationBasedResponsibilities.length" class="info-box">
            Er zijn geen ingebouwde functies.
        </p>

        <SpinnerWithTransition :is-loading="isLoading">
            <div v-if="rowCategories" class="container">
                <div v-if="rowCategories.requiredRows.length" class="container">
                    <hr>
                    <h2>Verplichte functies</h2>
                    <STList class="info">
                        <FunctionReview
                            v-for="row in rowCategories.requiredRows"
                            :key="row.responsibility.id"
                            :responsibility="row.responsibility"
                            :group="row.group"
                            :members="row.members"
                            :progress="row.progress"
                        />
                    </STList>
                </div>
            
                <div v-if="rowCategories.optionalRows.length" class="container">
                    <hr>
                    <h2>Optionele functies</h2>
                    <STList class="info">
                        <FunctionReview
                            v-for="row in rowCategories.optionalRows"
                            :key="row.responsibility.id"
                            :responsibility="row.responsibility"
                            :group="row.group"
                            :members="row.members"
                            :progress="row.progress"
                        />
                    </STList>
                </div>
            </div>
        </SpinnerWithTransition>
    </ReviewSetupStepView>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { SpinnerWithTransition, useAuth, useContext, useOrganization, usePlatform } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { Group, LimitedFilteredRequest, MemberResponsibility, MembersBlob, Organization, PaginatedResponseDecoder, PlatformFamily, PlatformMember, SetupStep, SetupStepType, SortItemDirection } from '@stamhoofd/structures';
import { computed, Ref, ref, watch } from 'vue';
import FunctionReview from './FunctionReview.vue';
import ReviewSetupStepView from './ReviewSetupStepView.vue';

defineProps<{step: SetupStep}>();

const $organization = useOrganization();
const $platform = usePlatform();
const context = useContext();
const owner = useRequestOwner();
const auth = useAuth();

const allRows = ref(null) as Ref<RowData[] | null>;

const rowCategories = computed(() => {
    if(allRows.value === null) {
        return null;
    }

    const requiredRows: RowData[] = [];
    const optionalRows: RowData[] = [];

    for(const row of allRows.value) {
        const responsibility = row.responsibility;
        const minimumMembers = responsibility.minimumMembers;
        const isRequired = !!minimumMembers;

        if(isRequired) {
            requiredRows.push(row);
        } else {
            optionalRows.push(row);
        }
    }

    return {
        requiredRows,
        optionalRows,
    }
});

const isLoading = computed(() => rowCategories.value === null);
const organizationBasedResponsibilities = computed(() => $platform.value.config.responsibilities.filter(r => r.organizationBased));

type RowProgress = {count: number, total: number | null};

type RowData = {
    responsibility: MemberResponsibility,
    group: Group | null,
    members: PlatformMember[],
    progress: RowProgress
}

watch(organizationBasedResponsibilities, async (responsibilities) => {
    const organization = $organization.value;
    if(!organization) return;
    const allMembers = await getAllMembersWithResponsibilities(responsibilities);
    const groups = getAllGroups(organization);
    const rows = responsibilities
        .flatMap(r => getRowData(r, allMembers, organization, groups))
        .sort((a, b) => getPriority(b.progress) - getPriority(a.progress));
    allRows.value = rows;
}, {immediate: true});

async function getAllMembersWithResponsibilities(responsibilities: MemberResponsibility[]): Promise<PlatformMember[]> {
    const organization = $organization.value;

    if(!organization) return [];

    const responsibilityIds = responsibilities.map(r => r.id);

    if(!responsibilityIds.length) return [];

    const query = new LimitedFilteredRequest({
        filter: {
            responsibilities: {
                $elemMatch: {
                    organizationId: organization.id,
                    responsibilityId: {
                        $in: responsibilityIds
                    },
                    $and: [
                        {
                            $or: [{
                                endDate: {
                                    $gt: { $: '$now' },
                                }
                            }, { endDate: { $eq: null } }]
                        }
                    ]
                }
            }
        },
        sort: [
            { key: 'firstName', order: SortItemDirection.ASC },
            { key: 'lastName', order: SortItemDirection.ASC },
            { key: 'id', order: SortItemDirection.ASC }],
        // todo: change limit? or get all?
        limit: 999
    });

    const response = await context.value.authenticatedServer.request({
        method: "GET",
        path: "/members",
        decoder: new PaginatedResponseDecoder(MembersBlob as Decoder<MembersBlob>, LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
        query,
        shouldRetry: false,
        owner
    });

    const blob = response.data.results;

    const results: PlatformMember[] = PlatformFamily.createSingles(blob, {
        contextOrganization: context.value.organization,
        platform: $platform.value
    });

    return results;
}

function getAllGroups(organization: Organization) {
    return organization.period.getCategoryTree({
        permissions: auth.permissions,
        organization,
        maxDepth: 1,
        smartCombine: true
    }).getAllGroups();
}

function getRowData(responsibility: MemberResponsibility, allMembersWithResponsibilities: PlatformMember[], organization: Organization, allGroups: Group[]): RowData[] {
    return getRowDataWithoutProgress(responsibility, allMembersWithResponsibilities, organization, allGroups)
        .map(row => {
            const progress = getProgress(row.responsibility, row.members);
            return {
                ...row,
                progress
            };
        });
}

function getPriority(progress: RowProgress) {
    if(progress.total === null) return 0;
    return 1;
}

function getRowDataWithoutProgress(responsibility: MemberResponsibility, allMembersWithResponsibilities: PlatformMember[], organization: Organization, allGroups: Group[]): Omit<RowData, 'progress'>[] {
    const responsibilityId = responsibility.id;
    const organizationId = organization.id;
    // todo: how to be sure this date is the same as the backend?
    const now = new Date();

    const defaultAgeGroupIds = responsibility.defaultAgeGroupIds;

    if(defaultAgeGroupIds !== null) {

        const rows: Omit<RowData, 'progress'>[] = [];

        for(const group of allGroups) {
            const groupId = group.id;

            const members = allMembersWithResponsibilities.filter(platformMember => platformMember.member.responsibilities
                .some(r => r.responsibilityId === responsibilityId
                        && r.organizationId === organizationId
                        && r.groupId === groupId
                        && (r.endDate === null || r.endDate > now)
                )
            );

            rows.push({
                responsibility,
                members,
                group
            });
        }

        return rows;
    }

    const members = allMembersWithResponsibilities.filter(platformMember => platformMember.member.responsibilities
        .some(r => r.responsibilityId === responsibilityId
                && r.organizationId === organizationId
                && (r.endDate === null || r.endDate > now)
        )
    );

    return [{
        responsibility,
        members,
        group: null
    }];
}

function getProgress(responsibility: MemberResponsibility, members: PlatformMember[]): RowProgress {
    const { minimumMembers, maximumMembers } = responsibility;

    if (minimumMembers === null && maximumMembers === null) {
        return {count: members.length, total: null};
    }

    const count = members.length;

    // count will be lower
    if (minimumMembers !== null && count < minimumMembers) {
        return {
            count,
            total: minimumMembers
        }
    }

    // count will exceed
    if (maximumMembers !== null && count > maximumMembers) {
        return {
            count,
            total: maximumMembers
        }
    }

    // other cases: show only count
    return {count, total: null}
}
</script>
