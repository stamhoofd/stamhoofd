<template>
    <STListItem :selectable="true" class="left-center" @click="navigate(Routes.View)">
        <template #left>
            <img src="@stamhoofd/assets/images/illustrations/event-notifications.svg">
        </template>
        <h2 class="style-title-list">
            {{ type.title }}
        </h2>
        <p class="style-description">
            {{ type.description }}
        </p>
        <template #right>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { Event, EventNotification, EventNotificationType } from '@stamhoofd/structures';
import { Formatter, sleep } from '@stamhoofd/utility';
import { ComponentOptions, onMounted, ref, Ref } from 'vue';
import EventNotificationView from '../EventNotificationView.vue';

const props = defineProps<{
    event: Event;
    type: EventNotificationType;
}>();

const notification = ref(null) as Ref<EventNotification | null>;
const loadNotificationPromise = loadEventNotification();
const navigate = useNavigate();

enum Routes {
    View = 'View',
}

defineRoutes([
    {
        name: Routes.View,
        url: Formatter.slug(props.type.title),
        component: EventNotificationView as ComponentOptions,
        present: 'popup',
        paramsToProps: async () => {
            await loadNotificationPromise;
            return {
                notification: notification.value!,
            };
        },
    },

]);

async function loadEventNotification() {
    // todo
    await sleep(1000);
    notification.value = EventNotification.create({
        typeId: props.type.id,
        events: [props.event],
    });
}

onMounted(() => {
    loadEventNotification().catch(console.error);
});

</script>
