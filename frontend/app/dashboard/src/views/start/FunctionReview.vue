<template>
    <STListItem>
        <template #left>
            <div v-if="progress">
                <span v-if="progress.total === null" class="icon success primary"/> 
                <ProgressRing v-else :radius="14" :progress="calculateProgress(progress)" :stroke="3" />
            </div>
        </template>
        <h3 class="style-title-list">
            {{ name }}
        </h3>
        <div>
            <p class="style-description-small">
                {{ membersAsString }}
            </p>
        </div>
        <template #right>
            <div v-if="progress">
                <p v-if="progress.total !== null" class="style-description-small">{{ progress.count }} / {{ progress.total }}</p>
                <p v-else class="style-description-small">{{ progress.count }}</p>
            </div>
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { Group, MemberResponsibility, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import ProgressRing from './ProgressRing.vue';

const props = defineProps<{
    responsibility: MemberResponsibility,
    group: Group | null,
    members: PlatformMember[],
    progress: {count: number, total: number | null} | null
}>();

const name = computed(() => {
    const name = props.responsibility.name;
    const group = props.group;
    if(group) {
        return `${name} van ${group.settings.name}`;
    }

    return name;
});

const membersAsString = computed(() => {
    const members = props.members;

    if (!members.length) return 'Geen';
    return members.map((platformMember) => platformMember.member.name).join(', ')
})

function calculateProgress({count, total}: {count: number, total: number | null}) {
    if(!total) return 1;
    return count / total;
}
</script>

<style lang="scss" scoped>
.extra-margin {
    margin-top: 7px;
}
</style>
