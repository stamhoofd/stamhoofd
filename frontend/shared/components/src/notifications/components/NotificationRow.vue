<template>
    <STListItem :selectable="true" class="right-stack" data-testid="notification-row" :data-unread="isUnread" @click="$emit('click', $event)" @contextmenu.prevent="$emit('contextmenu', $event)">
        <h3 class="style-title-list" :class="{ bolder: isUnread }">
            {{ title }}
        </h3>
        <p v-if="description" class="style-description-small">
            {{ description }}
        </p>
        <p class="style-description-small">
            {{ Formatter.capitalizeFirstLetter(Formatter.relativeTime(notification.updatedAt)) }}
        </p>

        <template #right>
            <span v-if="isUnread" class="icon dot red" data-testid="notification-unread-dot" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { NotificationType, NotificationTypeHelper } from '@stamhoofd/structures/notifications/NotificationType.js';
import { RegistrationCreatedNotificationPayload } from '@stamhoofd/structures/notifications/RegistrationCreatedNotificationPayload.js';
import type { UserNotification } from '@stamhoofd/structures/notifications/UserNotification.js';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import STListItem from '#layout/STListItem.vue';

const props = defineProps<{
    notification: UserNotification;
}>();

defineEmits<{
    click: [event: MouseEvent];
    contextmenu: [event: MouseEvent];
}>();

const isUnread = computed(() => props.notification.readAt === null);

const title = computed(() => {
    if (props.notification.type === NotificationType.RegistrationCreated) {
        const payload = RegistrationCreatedNotificationPayload.decodeBoxed(props.notification.payload);
        if (payload) {
            const count = Math.max(1, props.notification.groupResourceCount);
            if (count === 1) {
                return $t('%ZtD', { group: payload.group.name });
            }
            return $t('%ZtB', { count: count.toString(), group: payload.group.name });
        }
    }
    if (NotificationTypeHelper.isKnown(props.notification.type)) {
        return NotificationTypeHelper.getName(props.notification.type);
    }
    return $t('%wr');
});

const description = computed(() => {
    const names = props.notification.groupResources.map(r => r.name);
    const others = props.notification.groupResourceCount - names.length;
    if (others > 0) {
        return names.join(', ') + ' ' + $t('%M1') + ' ' + Formatter.pluralText(others, $t('%tu'), $t('%ZtJ'));
    }
    return Formatter.joinLast(names, ', ', ' ' + $t('%M1') + ' ');
});
</script>
