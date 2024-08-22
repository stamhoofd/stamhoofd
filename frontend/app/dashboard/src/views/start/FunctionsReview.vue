<template>
    <ReviewSetupStepView :title="title" :type="SetupStepType.Groups">
        <h1 class="style-navigation-title">
            Kijk even na
        </h1>

        <p>Kijk na of alle instellingen van de groepen correct zijn. Klik op een groep om deze te bewerken.</p>

        <hr>
        <h2>Verplichte functies</h2>
        <SpinnerWithTransition :is-loading="isLoading">
            <STList v-if="allMembersWithResponsibilities !== null" class="info">
                <FunctionReview v-for="responsibility in requiredResponsibilities" :key="responsibility.id" :responsibility="responsibility" :data="getRowData(responsibility)" />
            </STList>
        </SpinnerWithTransition>
        
        <hr>
        <h2>Andere functies</h2>
        <SpinnerWithTransition :is-loading="isLoading">
            <STList v-if="allMembersWithResponsibilities !== null" class="info">
                <FunctionReview v-for="responsibility in optionalResponsibilities" :key="responsibility.id" :responsibility="responsibility" :data="getRowData(responsibility)" />
            </STList>
        </SpinnerWithTransition>

        <hr>
        <h2>Niet toegekende functies</h2>
    </ReviewSetupStepView>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { SpinnerWithTransition, useAuth, useContext, useOrganization, usePlatform } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { Group, LimitedFilteredRequest, MemberResponsibility, MembersBlob, Organization, PaginatedResponseDecoder, PlatformFamily, PlatformMember, SetupStepType, SortItemDirection } from '@stamhoofd/structures';
import { computed, Ref, ref, watch } from 'vue';
import FunctionReview from './FunctionReview.vue';
import ReviewSetupStepView from './ReviewSetupStepView.vue';

const title = 'Kijk de functies na';

const $organization = useOrganization();
const $platform = usePlatform();
const context = useContext();
const owner = useRequestOwner();
const auth = useAuth();

const allMembersWithResponsibilities = ref(null) as Ref<PlatformMember[] | null>;
const isLoading = computed(() => allMembersWithResponsibilities.value === null);
const responsibilities = computed(() => $platform.value.config.responsibilities);
const requiredResponsibilities = computed(() => responsibilities.value.filter(r => r.minimumMembers !== null));
const optionalResponsibilities = computed(() => responsibilities.value.filter(r => r.minimumMembers === null));

type RowData = {
    responsibility: MemberResponsibility,
    allGroups: Group[],
    membersWithGroups: {
        platformMember: PlatformMember,
        groups?: (Group | null)[]
    }[]
}

watch(responsibilities, async (responsibilities) => {
    allMembersWithResponsibilities.value = await getAllMembersWithResponsibilities(responsibilities);
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
                        },
                        {
                            $or: [
                                {
                                    startDate: {
                                        $lte: { $: '$now' },
                                    }
                                }, {
                                    startDate: { $eq: null }
                                }
                            ]
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

let allGroupsCache: Group[] | null = null;

function getAllGroupsCached(organization: Organization) {
    if(allGroupsCache !== null) return allGroupsCache;

    allGroupsCache = organization.period.getCategoryTree({
        permissions: auth.permissions,
        organization,
        maxDepth: 1,
        smartCombine: true
    }).getAllGroups();

    return allGroupsCache;
}

function getEmptyRow(responsibility: MemberResponsibility): RowData {
    return {
        responsibility,
        allGroups: [],
        membersWithGroups: []
    }
}

function getRowData(responsibility: MemberResponsibility): RowData {
    const allMembers = allMembersWithResponsibilities.value;
    if(allMembers === null) return getEmptyRow(responsibility);

    const organization = $organization.value;
    if(!organization) return getEmptyRow(responsibility);

    const responsibilityId = responsibility.id;
    const organizationId = organization.id;

    // todo: how to be sure this date is the same as the backend?
    const now = new Date();

    const allGroups = getAllGroupsCached(organization);

    console.warn(JSON.stringify(allGroups))
    const membersWithGroups: {platformMember: PlatformMember, groups?: (Group | null)[]}[] = [];

    for(const platformMember of allMembers) {
        const responsibilities = platformMember.member.responsibilities;

        const responsibilitiesOfThisType = responsibilities.filter(responsibility => responsibility.responsibilityId === responsibilityId
                && responsibility.organizationId === organizationId
                && (responsibility.endDate === null || responsibility.endDate > now)
                && (responsibility.startDate === null || responsibility.startDate <= now));

        if(responsibilitiesOfThisType.length) {
            const groups: (Group | null)[] = [];

            for(const r of responsibilitiesOfThisType) {
                const groupId = r.groupId;
                if(!groupId) continue;

                const group = allGroups.find(g => g.id === groupId);
                groups.push(group ?? null);
            }

            membersWithGroups.push({
                platformMember,
                groups
            })
        }
    }

    return {
        responsibility,
        allGroups,
        membersWithGroups
    };
}
</script>
