<template>
    <IconContainer>
        <ImageComponent v-if="eventImage" :image="eventImage" class="event-image" />
        <GroupIcon v-else :group="group" :organization="organization" />
        <template #aside>
            <span class="icon email stroke small" />
        </template>
    </IconContainer>
</template>

<script setup lang="ts">
import type { Event, Group, Organization } from '@stamhoofd/structures';
import { computed } from 'vue';
import IconContainer from '../icons/IconContainer.vue';
import GroupIcon from '../members/components/group/GroupIcon.vue';
import ImageComponent from '../views/ImageComponent.vue';

const props
    = defineProps<{
        group: Group;
        organization?: Organization | null;
        event?: Event;
    }>();

const eventImage = computed(() => props.event?.meta.coverPhoto);
</script>
