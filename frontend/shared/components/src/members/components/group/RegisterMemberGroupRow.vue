<template>
    <STListItem :selectable="true">
        <template #left>
            <GroupIcon :group="group" />
        </template>

        <h4 class="style-title-list ">
            {{ group.settings.name }}
        </h4>

        <template #right>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { Group, Organization, PlatformMember } from '@stamhoofd/structures';

import GroupIcon from './GroupIcon.vue';

const props = defineProps<{
    group: Group;
    member: PlatformMember,
    organization: Organization
}>()

</script>
