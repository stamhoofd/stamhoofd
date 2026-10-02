import { computed } from 'vue';
import type { WebshopManager } from '../WebshopManager';

/**
 * Whether the offline database of this device might be missing tickets that exist on the server.
 */
export function useTicketSync(getWebshopManager: () => WebshopManager) {
    const isSyncing = computed(() => {
        const webshopManager = getWebshopManager();
        return webshopManager.tickets.isFetching || webshopManager.orders.isFetching;
    });

    const hasNeverSynced = computed(() => {
        const webshopManager = getWebshopManager();
        return !webshopManager.tickets.hasCompletedSync || !webshopManager.orders.hasCompletedSync;
    });

    const scannerSyncParts = computed(() => {
        const sync = getWebshopManager().scannerSync;
        return sync ? [sync.tickets, sync.orders] : [];
    });

    const progressPercentage = computed(() => {
        const parts = scannerSyncParts.value;

        // Until every running part knows its total, a percentage would jump back once it does
        if (parts.some(part => part.isRunning && part.progress === null)) {
            return null;
        }

        let count = 0;
        let total = 0;
        for (const part of parts) {
            if (part.progress) {
                count += part.isRunning ? part.progress.count : part.progress.total;
                total += part.progress.total;
            }
        }
        if (total === 0) {
            return null;
        }
        return Math.min(100, Math.floor(count / total * 100));
    });

    /**
     * A sync of more than one page of new orders or tickets is running.
     */
    const isCatchingUp = computed(() => scannerSyncParts.value.some(part => part.progress !== null));

    const mightMissTickets = computed(() => isCatchingUp.value || hasNeverSynced.value);

    return {
        isSyncing,
        hasNeverSynced,
        isCatchingUp,
        mightMissTickets,
        progressPercentage,
    };
}
