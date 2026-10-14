import { useProvideEventWebshopViewLoaders } from '@stamhoofd/components/events/eventWebshopViewLoaders.ts';

export function useProvideEventWebshopViews() {
    useProvideEventWebshopViewLoaders({
        overview: async () => (await import('../views/dashboard/webshop/WebshopOverview.vue')).default,
        edit: () => import('../views/dashboard/webshop/edit/EditWebshopGeneralView.vue'),
    });
}
