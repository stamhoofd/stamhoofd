<template>
    <STListItem>
        <div v-if="data.responsibility.defaultAgeGroupIds">
            <h3 class="style-title-list">
                {{ name }} per standaard leeftijdsgroep
            </h3>
            <p class="style-description-small">
                Enkele de standaard leeftijdsgroepen die gekoppeld zijn aan deze functie worden weergegeven.
            </p>

            <STListItemGrid>
                <STListItemGridRow v-for="group of getGroups()" :key="group.id" :label="group.settings.name" :value="getMembersForGroup(group)" />
            </STListItemGrid>
        </div>
        <div v-else>
            <h3 class="style-title-list">
                {{ name }}
            </h3>
            <p class="style-description-small">
                {{ membersToString(data.membersWithGroups.map(x => x.platformMember)) }}
            </p>
        </div>
    </STListItem>
</template>

<script lang="ts" setup>
import { STListItemGrid, STListItemGridRow } from '@stamhoofd/components';
import { Group, MemberResponsibility, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{data: {responsibility: MemberResponsibility, allGroups: Group[], membersWithGroups: {platformMember: PlatformMember, groups?: (Group | null)[]}[]}}>();

const name = computed(() => props.data.responsibility.name);

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

function getGroupName(id: string) {
    return props.data.allGroups.find(g => g.defaultAgeGroupId === id)?.settings.name || 'Onbekend';
}

function getMembersStringForDefaultAgeGroup(id: string) {
    const members = props.data.membersWithGroups.filter(x => x.groups?.some(g => g?.defaultAgeGroupId === id)).map(x => x.platformMember);

    return membersToString(members);
}

function membersToString(members: PlatformMember[]): string {
    if (!members.length) return 'Geen';
    return members.map((platformMember) => platformMember.member.name).join(', ')
}
</script>
