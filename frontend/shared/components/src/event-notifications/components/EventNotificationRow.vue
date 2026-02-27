<template>
    <STListItem :selectable="true" class="left-center right-stack" @click="navigate(Routes.View)">
        <template #left>
            <img src="@stamhoofd/assets/images/illustrations/tent.svg">
        </template>
        <h2 class="style-title-list">
            {{ type.title }}
        </h2>
        <p class="style-description style-limit-lines pre-wrap">
            {{ type.description }}
        </p>
        <template #right>
            <span v-if="notification" class="hide-smartphone">{{ capitalizeFirstLetter(EventNotificationStatusHelper.getName(notification.status)) }}</span>
            <span v-else-if="loading" class="style-placeholder-skeleton" />
            <span v-else-if="errors.errorBox" class="icon error" />

            <span v-if="notification && notification.status === EventNotificationStatus.Pending" class="icon clock gray" />
            <span v-if="notification && notification.status === EventNotificationStatus.Rejected" class="icon error" />
            <span v-if="notification && notification.status === EventNotificationStatus.Accepted" class="icon success green" />
            <span v-if="notification && notification.status === EventNotificationStatus.PartiallyAccepted" class="icon partially green" />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { ComponentWithProperties, defineRoutes, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { Event, EventNotificationStatus, EventNotificationStatusHelper, EventNotificationType, Organization } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { usePlatform } from '../../hooks';
import { ViewStepsManager } from '#steps/ViewStepsManager';
import { Toast } from '../../overlays/Toast';
import { useNavigationActions } from '../../types/NavigationActions';
import EventNotificationView from '../EventNotificationView.vue';
import { useEventNotification } from '../hooks/useEventNotification';
import { EventNotificationViewModel } from '../classes/EventNotificationViewModel';
import { getEventNotificationSteps } from '../getEventNotificationSteps';

const props = defineProps<{
    event: Event;
    type: EventNotificationType;
    organization: Organization;
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
                        organization: props.organization,
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
