import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { onBeforeUnmount, watch } from 'vue';
import { useTicketSync } from '../tickets/useTicketSync';
import type { WebshopManager } from '../WebshopManager';

/**
 * Shows a toast with the download progress while more than one page of new orders or tickets is being downloaded.
 */
export function useOrdersSyncToast(getWebshopManager: () => WebshopManager) {
    const { isCatchingUp, progressPercentage, hasNeverSynced } = useTicketSync(getWebshopManager);
    let toast: Toast | null = null;

    function hideToast() {
        toast?.hide();
        toast = null;
    }

    watch([isCatchingUp, progressPercentage], ([catchingUp, percentage]) => {
        if (!catchingUp) {
            hideToast();
            return;
        }

        if (!toast) {
            const message = hasNeverSynced.value
                ? $t('Bestellingen ophalen... Dit gebeurt eenmalig, daarna zijn ze offline beschikbaar en laden ze sneller.')
                : $t('Bestellingen ophalen...');
            toast = new Toast(message, 'spinner').setHide(null).show();
        }

        toast.setProgress(percentage === null ? null : percentage / 100);
    }, { immediate: true });

    onBeforeUnmount(hideToast);
}
