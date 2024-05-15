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
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { Group, PlatformMember, RegisterItem } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

import GroupIcon from './GroupIcon.vue';

const props = defineProps<{
    group: Group;
    member: PlatformMember
}>()

enum Routes {
    Group = 'group',
}
defineRoutes([
    {
        name: Routes.Group,
        url: Formatter.slug(props.group.settings.name),
        component: async () => (await import('../GroupView.vue')).default as any,
        paramsToProps() {
            const member = props.member
            const group = props.group

            return {
                member,
                group
            }
        }
    }
])

const $navigate = useNavigate()

const registerItem = computed(() => RegisterItem.defaultFor(props.member, props.group))
const waitingList = computed(() => registerItem.value.waitingList)

async function openGroup() {
    await $navigate(Routes.Group);
}

</script>
