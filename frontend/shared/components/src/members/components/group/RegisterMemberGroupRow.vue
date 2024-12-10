<template>
    <STListItem :selectable="true">
        <template #left>
            <GroupIconWithWaitingList :group="group" :icon="willChangeToWaitingList ? 'clock' : ''" />
        </template>

        <h4 class="style-title-list ">
            {{ group.settings.name }}
        </h4>

        <p v-if="group.settings.description" class="style-description-small style-limit-lines">
            {{ group.settings.description.trim() }}
        </p>

        <template #right>
            <span v-if="validationWarning" v-tooltip="validationWarning" class="icon warning yellow" />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { Group, Organization, PlatformMember, RegisterItem } from '@stamhoofd/structures';
import { computed } from 'vue';
import GroupIconWithWaitingList from './GroupIconWithWaitingList.vue';

const props = defineProps<{
    group: Group;
    member: PlatformMember;
    organization: Organization;
}>();

const willChangeToWaitingList = computed(() => {
    return !props.member.canRegister(props.group, props.organization) && props.member.canRegisterForWaitingList(props.group, props.organization);
});

const item = RegisterItem.defaultFor(props.member, props.group, props.organization);

const validationWarning = computed(() => {
    if (item.validationError) {
        return null;
    }

    if (item.validationWarning) {
        return item.validationWarning;
    }

    return null;
});
</script>
