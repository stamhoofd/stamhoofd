import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { LimitedFilteredRequest } from '@stamhoofd/structures';
import PromiseView from '#containers/PromiseView.vue';
import { useEventsObjectFetcher } from '#fetchers/useEventsObjectFetcher.ts';
import { Toast } from '../../overlays/Toast';
import EventOverview from '../EventOverview.vue';

export function useShowEvent() {
    const present = usePresent();
    const eventFetcher = useEventsObjectFetcher();

    return async (eventId: string) => {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PromiseView, {
                promise: async () => {
                    const events = await eventFetcher.fetch(new LimitedFilteredRequest({
                        filter: {
                            id: eventId,
                        },
                        limit: 1,
                    }));
                    if (events.results.length === 0) {
                        Toast.error($t(`%yY`)).show();
                        throw new Error('Event not found');
                    }
                    return new ComponentWithProperties(EventOverview, {
                        event: events.results[0],
                    });
                },
            }),
        });

        await present({
            components: [component],
            modalDisplayStyle: 'popup',
        });
    };
}
