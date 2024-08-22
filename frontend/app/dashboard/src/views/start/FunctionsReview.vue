<template>
    <ReviewSetupStepView :title="title" :type="SetupStepType.Groups">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <p>Kijk hieronder na of alle functies toegekend zijn. Om een functie toe te kennen ga je naar het tabblad "Leden". Daar kan je met de rechtermuisknop op een lid klikken en "Functies bewerken" kiezen. </p>

        <p class="info-box" v-if="!responsibilities.length">Er zijn geen ingebouwde functies.</p>

        <SpinnerWithTransition :is-loading="isLoading">
            <div v-if="rowCategories" class="container">
                <div v-if="rowCategories.requiredRows.length" class="container">
                    <hr>
                    <h2>Verplichte functies</h2>
                    <STList class="info">
                        <FunctionReview v-for="row in rowCategories.requiredRows" :key="row.responsibility.id" :data="row" />
                    </STList>
                </div>
            
                <div v-if="rowCategories.optionalAndAssignedRows.length" class="container">
                    <hr>
                    <h2>Optionele functies</h2>
                    <STList class="info">
                        <FunctionReview v-for="row in rowCategories.optionalAndAssignedRows" :key="row.responsibility.id" :data="row" />
                    </STList>
                </div>

                <div v-if="rowCategories.nonAssignedRows.length" class="container">
                    <hr>
                    <h2>Niet-toegekende functies</h2>
                    <STList class="info">
                        <FunctionReview v-for="row in rowCategories.nonAssignedRows" :key="row.responsibility.id" :data="row" />
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
import { Group, LimitedFilteredRequest, MemberResponsibility, MembersBlob, Organization, PaginatedResponseDecoder, PlatformFamily, PlatformMember, SetupStepType, SortItemDirection } from '@stamhoofd/structures';
import { computed, Ref, ref, watch } from 'vue';
import FunctionReview from './FunctionReview.vue';
import ReviewSetupStepView from './ReviewSetupStepView.vue';

const title = 'Functies nakijken';

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
    const optionalAndAssignedRows: RowData[] = [];
    const nonAssignedRows: RowData[] = [];

    for(const row of allRows.value) {
        const responsibility = row.responsibility;
        const isRequired = responsibility.minimumMembers !== null;

        if(isRequired) {
            requiredRows.push(row);
        } else if(row.membersWithGroups.length > 0) {
            optionalAndAssignedRows.push(row);
        } else {
            nonAssignedRows.push(row);
        }
    }

    return {
        requiredRows,
        optionalAndAssignedRows,
        nonAssignedRows
    }
});

const isLoading = computed(() => rowCategories.value === null);
const responsibilities = computed(() => $platform.value.config.responsibilities);

type RowData = {
    responsibility: MemberResponsibility,
    allGroups: Group[],
    membersWithGroups: {
        platformMember: PlatformMember,
        groups?: (Group | null)[]
    }[]
}

watch(responsibilities, async (responsibilities) => {
    const organization = $organization.value;
    if(!organization) return;
    const allMembers = await getAllMembersWithResponsibilities(responsibilities);
    const groups = getAllGroups(organization);
    const rows = responsibilities.map(r => getRowData(r, allMembers, organization, groups));
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

function getAllGroups(organization: Organization) {
    return organization.period.getCategoryTree({
        permissions: auth.permissions,
        organization,
        maxDepth: 1,
        smartCombine: true
    }).getAllGroups();
}

function getRowData(responsibility: MemberResponsibility, allMembersWithResponsibilities: PlatformMember[], organization: Organization, allGroups: Group[]): RowData {
    const responsibilityId = responsibility.id;
    const organizationId = organization.id;

    // todo: how to be sure this date is the same as the backend?
    const now = new Date();

    const membersWithGroups: {platformMember: PlatformMember, groups?: (Group | null)[]}[] = [];

    for(const platformMember of allMembersWithResponsibilities) {
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
