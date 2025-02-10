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
            <span v-if="notification">{{ notification.status }}</span>
            <span v-else-if="loading" class="style-placeholder-skeleton" />
            <span v-else-if="errors.errorBox" class="icon error" />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { ComponentWithProperties, defineRoutes, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { Event, EventNotification, EventNotificationType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions } from 'vue';
import { Toast } from '../../overlays/Toast';
import EventNotificationView from '../EventNotificationView.vue';
import { useEventNotification } from '../composables/useEventNotification';
import { EventNotificationViewModel } from '../event-notifications/classes/EventNotificationViewModel';
import { getEventNotificationSteps } from '../event-notifications/getEventNotificationSteps';
import { usePlatform } from '../../hooks';
import { ViewStepsManager } from '../../members/classes/ViewStepsManager';
import { useNavigationActions } from '../../types/NavigationActions';

const props = defineProps<{
    event: Event;
    type: EventNotificationType;
}>();

const { promise: loadNotificationPromise, notification, loading, errors } = useEventNotification({
    event: props.event,
    typeId: props.type.id,
});
const navigate = useNavigate();
const present = usePresent();
const platform = usePlatform();
const navigationActions = useNavigationActions();

enum Routes {
    View = 'View',
}

defineRoutes([
    {
        name: Routes.View,
        url: Formatter.slug(props.type.title),
        present: 'popup',
        handler: async (options) => {
            if (!options.componentProperties.viewModel || !(options.componentProperties.viewModel instanceof EventNotificationViewModel)) {
                return;
            }

            const viewModel = options.componentProperties.viewModel;
            if (viewModel.isNew) {
                // Start flow
                const steps = getEventNotificationSteps(viewModel);
                const manager = new ViewStepsManager(steps, async ({ show }) => {
                    await show({
                        components: [
                            new ComponentWithProperties(EventNotificationView, options.componentProperties),
                        ],
                        replace: 1000,
                        force: true,
                    });
                }, {
                    action: 'present',
                    modalDisplayStyle: 'popup',
                    checkRoutes: options.checkRoutes,
                    url: options.url,
                    adjustHistory: options.adjustHistory,
                    animated: options.animated,
                });
                await manager.start(navigationActions);
            }
            else {
                // Go to the general view
                await present({
                    components: [
                        new ComponentWithProperties(EventNotificationView, options.componentProperties),
                    ],
                    checkRoutes: options.checkRoutes,
                    url: options.url,
                    adjustHistory: options.adjustHistory,
                    animated: options.animated,
                    modalDisplayStyle: 'popup',
                });
            }
        },
        paramsToProps: async () => {
            try {
                await loadNotificationPromise;
            }
            catch (e) {
                Toast.fromError(e).show();
                throw e;
            }

            if (!notification.value) {
                // Create a new one
                return {
                    viewModel: EventNotificationViewModel.createNew({
                        typeId: props.type.id,
                        events: [props.event],
                        saveHandler: async (viewModel: EventNotificationViewModel) => {
                            // Make sure we edit this newly created one the next time
                            notification.value = viewModel.eventNotification;
                        },
                        platform: platform.value,
                    }),
                };
            }

            // Create a new one
            return {
                viewModel: EventNotificationViewModel.edit({
                    eventNotification: notification.value,
                    saveHandler: async (viewModel: EventNotificationViewModel) => {
                        // Make sure we edit this newly created one the next time
                        notification.value = viewModel.eventNotification;
                    },
                    platform: platform.value,
                }),
            };
        },
    },

]);

</script>
