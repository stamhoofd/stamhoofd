<template>
    <IconContainer v-if="image">
        <ImageComponent :image="image" class="event-image" />
    </IconContainer>
    <img v-else :src="calendarSvg" class="style-illustration-img">
</template>

<script setup lang="ts">
import calendarSvg from '@stamhoofd/assets/images/illustrations/calendar.svg';
import { IconContainer, ImageComponent } from '@stamhoofd/components';
import { Event } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    event: Event;
}>();

const image = computed(() => props.event.meta.coverPhoto);
</script>
