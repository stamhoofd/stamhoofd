import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import PromiseView from '@stamhoofd/components/containers/PromiseView.vue';
import { useOrganizationsObjectFetcher } from '@stamhoofd/components/fetchers';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { LimitedFilteredRequest } from '@stamhoofd/structures';

export function useShowOrganization() {
    const present = usePresent();
    const organizationFetcher = useOrganizationsObjectFetcher();

    return async (organizationId: string) => {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PromiseView, {
                promise: async () => {
                    const organizations = await organizationFetcher.fetch(new LimitedFilteredRequest({
                        filter: {
                            id: organizationId,
                        },
                        limit: 1,
                    }));
                    if (organizations.results.length === 0) {
                        Toast.error($t(`%yZ`)).show();
                        throw new Error('Organization not found');
                    }
                    const OrganizationView = (await import('./OrganizationView.vue')).default;
                    return new ComponentWithProperties(OrganizationView, {
                        organization: organizations.results[0],
                        getNext: () => null,
                        getPrevious: () => null,
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
