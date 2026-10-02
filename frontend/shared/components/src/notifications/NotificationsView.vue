<template>
    <!-- Fixed height (limited to the available height) avoids height jumps while loading more notifications -->
    <div class="st-view" data-testid="notifications-view" style="height: min(400px, calc(var(--vh, 1vh) * 100))">
        <STNavigationBar :title="$t('%1FR')">
            <template #right>
                <button class="button icon more" type="button" data-testid="notifications-more-button" @click.prevent="showMoreMenu" @contextmenu.prevent="showMoreMenu" />
            </template>
        </STNavigationBar>

        <main>
            <h1>{{ $t('%1FR') }}</h1>

            <STList>
                <NotificationRow v-for="notification of fetcher.objects" :key="notification.id" :notification="notification" @click="open(notification)" @contextmenu="showContextMenu($event, notification)" />
            </STList>

            <p v-if="errorMessage" class="error-box with-button">
                {{ errorMessage }}

                <button class="button text" type="button" @click="fetcher.reset()">
                    {{ $t('%Y9') }}
                </button>
            </p>
            <InfiniteObjectFetcherEnd v-else :fetcher="fetcher" :empty-message="$t('%Ztd')" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { useShow } from '@simonbackx/vue-app-navigation';
import { computed } from 'vue';
import { NotificationTypeHelper } from '@stamhoofd/structures/notifications/NotificationType.js';
import type { UserNotification } from '@stamhoofd/structures/notifications/UserNotification.js';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useNotificationsObjectFetcher } from '#fetchers/useNotificationsObjectFetcher.ts';
import STList from '#layout/STList.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { ContextMenu, ContextMenuItem } from '#overlays/ContextMenu.ts';
import { Toast } from '#overlays/Toast.ts';
import { useInfiniteObjectFetcher } from '#tables/classes/InfiniteObjectFetcher.ts';
import InfiniteObjectFetcherEnd from '#tables/InfiniteObjectFetcherEnd.vue';
import NotificationRow from './components/NotificationRow.vue';
import { useNotificationActionResolver } from './useNotificationActionResolver';
import { useNotificationActions } from './useNotificationActions';

const props = withDefaults(defineProps<{
    onReadChange?: (() => void) | null;
}>(), {
    onReadChange: null,
});

const show = useShow();
const { markAsRead, markAllAsRead, unsubscribe } = useNotificationActions();
const getAction = useNotificationActionResolver();
const fetcher = useInfiniteObjectFetcher<UserNotification>(useNotificationsObjectFetcher());
const errorMessage = computed(() => fetcher.errorState ? new ErrorBox(fetcher.errorState).originalErrors.getHuman() : null);

async function run(action: () => Promise<void>) {
    try {
        await action();
    } catch (e) {
        Toast.fromError(e).show();
    }
}

async function read(notification: UserNotification) {
    if (notification.readAt) {
        return;
    }
    await markAsRead(notification);
    props.onReadChange?.();
}

async function open(notification: UserNotification) {
    // Mark as read first: navigating away cancels the pending requests of this view
    await run(() => read(notification));

    const action = getAction(notification);
    if (action) {
        await run(action.run);
    }
}

async function readAll() {
    await run(async () => {
        await markAllAsRead();
        const now = new Date();
        for (const notification of fetcher.objects) {
            if (!notification.readAt) {
                notification.readAt = now;
                notification.readCount = notification.groupResourceCount;
            }
        }
        props.onReadChange?.();
    });
}

async function showMoreMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t('%ZtH'),
                icon: 'success',
                action: () => {
                    readAll().catch(console.error);
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t('%ZtV'),
                icon: 'settings',
                action: () => {
                    show(AsyncComponent(() => import('./NotificationSettingsView.vue'), {})).catch(console.error);
                    return true;
                },
            }),
        ],
    ]);
    await menu.show({ button: event.currentTarget as HTMLElement, xPlacement: 'left', yPlacement: 'bottom' });
}

async function showContextMenu(event: MouseEvent, notification: UserNotification) {
    const action = getAction(notification);

    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t('%ZtW'),
                icon: 'success',
                disabled: !!notification.readAt,
                action: () => {
                    run(() => read(notification)).catch(console.error);
                    return true;
                },
            }),
            ...(action
                ? [new ContextMenuItem({
                        name: action.name,
                        icon: 'arrow-right',
                        action: () => {
                            open(notification).catch(console.error);
                            return true;
                        },
                    })]
                : []),
        ],
        [
            new ContextMenuItem({
                name: $t('%ZtF'),
                icon: 'disabled',
                action: () => {
                    run(async () => {
                        await unsubscribe(notification.type);
                        const name = NotificationTypeHelper.isKnown(notification.type) ? NotificationTypeHelper.getName(notification.type) : notification.type;
                        Toast.success($t('%ZtK', { type: name })).show();
                    }).catch(console.error);
                    return true;
                },
            }),
        ],
    ]);
    await menu.show({ clickEvent: event });
}
</script>
