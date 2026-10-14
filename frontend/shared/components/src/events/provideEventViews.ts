import { useProvideEventViewLoaders } from '#events/eventViewLoaders.ts';

export function useProvideEventViews() {
    useProvideEventViewLoaders({
        overview: () => import('#events/EventOverview.vue'),
    });
}
