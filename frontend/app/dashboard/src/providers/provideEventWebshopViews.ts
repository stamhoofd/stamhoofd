import { eventWebshopViewsKey } from '@stamhoofd/components/events/EventWebshopViews';
import { provide } from 'vue';

export function useProvideEventWebshopViews() {
    provide(eventWebshopViewsKey, {
        overview: async () => (await import('../views/dashboard/webshop/WebshopOverview.vue')).default,
        edit: () => import('../views/dashboard/webshop/edit/EditWebshopGeneralView.vue'),
    });
}
