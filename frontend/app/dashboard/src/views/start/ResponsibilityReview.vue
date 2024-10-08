<template>
    <STListItem>
        <template #left>
            <IconContainer :class="color" :icon="'group'">
                <GroupIcon v-if="group" :group="group" />
                <template #aside>
                    <ProgressIcon :icon="$icon" :count="count" :progress="progress" />
                </template>
            </IconContainer>
        </template>
        <h3 class="style-title-list">
            {{ name }}
        </h3>
        <div>
            <p v-if="placeholderString" class="style-description-small">
                {{ placeholderString }}
            </p>

            <p v-for="member of members" :key="member.id" class="style-description-small inline-link secundary" @click="editMember(member)">
                {{ member.member.name }}
            </p>
        </div>
        <template #right>
            <div>
                <p v-if="total !== undefined" class="style-description-small">
                    {{ members.length }} / {{ total }}
                </p>
                <p v-else-if="count !== undefined" class="style-description-small">
                    {{ count }}
                </p>
            </div>
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { GroupIcon, IconContainer, ProgressIcon, STListItem, useMemberActions } from '@stamhoofd/components';
import { Group, MemberResponsibility, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    responsibility: MemberResponsibility;
    group: Group | null;
    members: PlatformMember[];
    count?: number;
    progress?: number;
    total?: number;
}>();

const color = computed(() => {
    const icon = $icon.value;
    if (icon === 'success') return 'success';
    return 'gray';
});

const $icon = computed<'help' | 'success' | 'error' | undefined>(() => {
    const isOptional = $isOptional.value;
    if (!isOptional && props.count !== undefined) return 'success';

    const progress = props.progress;
    if (progress !== undefined) {
        if (progress === 0 && !isOptional) return 'help';
        if (progress > 1) return 'error';
        if (progress === 1) return 'success';
    }

    return undefined;
});

const $isOptional = computed(() => !props.responsibility.minimumMembers);

const name = computed(() => {
    const name = props.responsibility.name;
    const group = props.group;
    if (group) {
        return `${name} van ${group.settings.name}`;
    }

    return name;
});

const placeholderString = computed(() => {
    if (!props.members.length) {
        if ($isOptional.value) {
            return 'Geen';
        }
        return 'Deze functie moet nog worden toegekend';
    }
    return '';
});

const actionBuilder = useMemberActions();

async function editMember(member: PlatformMember) {
    await actionBuilder().showMember(member);
}
</script>

<style lang="scss" scoped>
.extra-margin {
    margin-top: 7px;
}
</style>
