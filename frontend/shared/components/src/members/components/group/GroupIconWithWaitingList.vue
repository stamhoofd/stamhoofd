<template>
    <IconContainer>
        <GroupIcon :group="group" :organization="organization" />
        <template #aside>
            <span v-if="icon" class="icon stroke small" :class="icon" />
            <span v-else-if="waitingList" class="icon clock small stroke" />
        </template>
    </IconContainer>
</template>

<script setup lang="ts">
import { Group, GroupType, Organization } from '@stamhoofd/structures';
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
