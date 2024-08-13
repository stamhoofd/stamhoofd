<template>
    <STListItem :selectable="true">
        <template #left>
            <GroupIcon :group="group" :icon="willChangeToWaitingList ? 'clock' : ''" />
        </template>

        <h4 class="style-title-list ">
            {{ group.settings.name }}
        </h4>

        <p class="style-description-small style-limit-lines">
            {{ group.settings.description }}
        </p>

        <template #right>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { Group, Organization, PlatformMember } from '@stamhoofd/structures';

import GroupIcon from './GroupIcon.vue';
import { computed } from 'vue';

const props = defineProps<{
    group: Group;
    member: PlatformMember,
    organization: Organization
}>()

const willChangeToWaitingList = computed(() => {
    return !props.member.canRegister(props.group, props.organization) && props.member.canRegisterForWaitingList(props.group, props.organization)
})

</script>
