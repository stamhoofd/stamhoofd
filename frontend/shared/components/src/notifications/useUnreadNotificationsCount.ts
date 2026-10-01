import { Request } from '@simonbackx/simple-networking';
import { computed, reactive } from 'vue';
import { useUser } from '#hooks/useUser.ts';
import { useNotificationActions } from './useNotificationActions';

/**
 * Shared by all notification buttons (the navigation bar of every tab has its own), per user
 */
const unreadCounts = reactive(new Map<string, number>());
const lastRefreshes = new Map<string, number>();
const pendingRefreshes = new Map<string, Promise<void>>();

export function useUnreadNotificationsCount() {
    const user = useUser();
    const { fetchUnreadCount } = useNotificationActions();

    const count = computed(() => (user.value ? unreadCounts.get(user.value.id) : undefined) ?? 0);

    async function refresh(options: { minimumInterval?: number } = {}) {
        const userId = user.value?.id;
        if (!userId) {
            return;
        }

        const pending = pendingRefreshes.get(userId);
        if (pending) {
            return await pending;
        }

        if (options.minimumInterval && Date.now() - (lastRefreshes.get(userId) ?? 0) < options.minimumInterval) {
            return;
        }
        lastRefreshes.set(userId, Date.now());

        const promise = (async () => {
            try {
                unreadCounts.set(userId, await fetchUnreadCount());
            } catch (e) {
                if (!Request.isAbortError(e)) {
                    console.error(e);
                }
            } finally {
                pendingRefreshes.delete(userId);
            }
        })();
        pendingRefreshes.set(userId, promise);
        await promise;
    }

    return { count, refresh };
}
