<template>
    <IconContainer :aside-icon="icon || (waitingList ? 'clock' : undefined)">
        <GroupIcon :group="group" :organization="organization" />
    </IconContainer>
</template>

<script setup lang="ts">
import type { Group, Organization } from '@stamhoofd/structures';
import { GroupType } from '@stamhoofd/structures';
import { computed } from 'vue';
import IconContainer from '../../../icons/IconContainer.vue';
import GroupIcon from './GroupIcon.vue';

const props
    = defineProps<{
        group: Group;
        organization?: Organization | null; // Optionally use organization logo if no other is available
        icon?: string;
    }>();

const waitingList = computed(() => props.group.type === GroupType.WaitingList);
</script>
