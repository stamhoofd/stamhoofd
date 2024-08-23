<template>
    <STListItem>
        <template #left>
            <IconWithProgress icon="group" :progress="progress" :is-optional="isOptional" :has-warning="!isOptional && progress.count === 0" />
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
import IconWithProgress from './IconWithProgress.vue';

const props = defineProps<{
    responsibility: MemberResponsibility,
    group: Group | null,
    members: PlatformMember[],
    progress: {count: number, total: number | null}
}>();

const isOptional = computed(() => !props.responsibility.minimumMembers);

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

    if (!members.length) {
        if(isOptional.value) {
            return 'Geen';
        }
        return 'Deze functie moet nog worden toegekend';
    }
    return members.map((platformMember) => platformMember.member.name).join(', ')
});
</script>

<style lang="scss" scoped>
.extra-margin {
    margin-top: 7px;
}
</style>
