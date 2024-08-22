<template>
    <STListItem>
        <template #left>
            <div v-if="progressData">
                <span v-if="progressData.total === undefined" class="icon success primary"/> 
                <ProgressRing v-else :radius="14" :progress="calculateProgress(progressData)" :stroke="3" />
            </div>
        </template>
        <h3 class="style-title-list">
            {{ name }}
        </h3>
        <div v-if="data.responsibility.defaultAgeGroupIds">
            <p class="style-description-small">
                Enkele de standaard leeftijdsgroepen die gekoppeld zijn aan deze functie worden weergegeven.
            </p>

            <div class="extra-margin">
                <STListItemGrid>
                    <STListItemGridRow v-for="group of getGroups()" :key="group.id" :label="group.settings.name" :value="getMembersForGroup(group)" :emphasize-label="true" />
                </STListItemGrid>
            </div>
        </div>
        <div v-else>
            <p class="style-description-small">
                {{ membersToString(data.membersWithGroups.map(x => x.platformMember)) }}
            </p>
        </div>
        <template #right>
            <div v-if="progressData">
                <p v-if="progressData.total !== undefined" class="style-description-small">{{ progressData.count }} / {{ progressData.total }}</p>
                <p v-else class="style-description-small">{{ progressData.count }}</p>
            </div>
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { STListItemGrid, STListItemGridRow } from '@stamhoofd/components';
import { Group, MemberResponsibility, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import ProgressRing from './ProgressRing.vue';

const props = defineProps<{data: {responsibility: MemberResponsibility, allGroups: Group[], membersWithGroups: {platformMember: PlatformMember, groups?: (Group | null)[]}[]}}>();

const name = computed(() => props.data.responsibility.name);

const progressData = computed(() => {
    const responsibility = props.data.responsibility;
    const { minimumMembers, maximumMembers } = responsibility;

    if (minimumMembers === null && maximumMembers === null) {
        return null;
    }

    const count = props.data.membersWithGroups.length;

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
    return {count}
});

function calculateProgress({count, total}: {count: number, total?: number}) {
    if(!total) return 1;
    return count / total;
}

function getGroups(): Group[] {
    const defaultAgeGroupIds = props.data.responsibility.defaultAgeGroupIds;
    if (!defaultAgeGroupIds) return [];

    const allGroups = props.data.allGroups;

    const groups = defaultAgeGroupIds
        .flatMap(id => allGroups
            .filter(g => g.defaultAgeGroupId === id)
        )
        .filter(g => !!g)
        .sort((a, b) => {
            const minA = a.settings.minAge === null ? 999 : a.settings.minAge;
            const minB = b.settings.minAge === null ? 999 : b.settings.minAge;

            if(minA === minB) {
                return a.settings.name.localeCompare(b.settings.name);
            }

            return minA - minB;
        });

    return groups;
}

function getMembersForGroup(group: Group) {
    const id = group.id;
    const members = props.data.membersWithGroups.filter(x => x.groups?.some(g => g?.id === id)).map(x => x.platformMember);

    return membersToString(members);
}

function membersToString(members: PlatformMember[]): string {
    if (!members.length) return 'Geen';
    return members.map((platformMember) => platformMember.member.name).join(', ')
}
</script>

<style lang="scss" scoped>
.extra-margin {
    margin-top: 7px;
}
</style>
