<template>
    <STListItem :selectable="true" @click="openGroup">
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
import { Group, PlatformMember, RegisterItem } from '@stamhoofd/structures';
import { computed } from 'vue';

import { useMemberManager } from '../../../getRootView';
import GroupIcon from './GroupIcon.vue'

const props = defineProps<{
    group: Group;
    member: PlatformMember
}>()

const memberManager = useMemberManager()

const registerItem = computed(() => memberManager.defaultItem(props.member, props.group))
const waitingList = computed(() => registerItem.value.waitingList)

function openGroup() {
    // this.show(new ComponentWithProperties(GroupView, {
    //     group: this.group,
    //     member: this.member
    // }))
}

</script>
