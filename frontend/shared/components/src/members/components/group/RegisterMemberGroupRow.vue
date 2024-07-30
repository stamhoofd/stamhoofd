<template>
    <STListItem :selectable="true">
        <template #left>
            <GroupIcon :group="group" :waiting-list="waitingList" />
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
import { Group, Organization, PlatformMember, RegisterItem } from '@stamhoofd/structures';
import { computed } from 'vue';

import GroupIcon from './GroupIcon.vue';

const props = defineProps<{
    group: Group;
    member: PlatformMember,
    organization: Organization
}>()

const registerItem = computed(() => RegisterItem.defaultFor(props.member, props.group, props.organization))
const waitingList = computed(() => registerItem.value.waitingList)

</script>
