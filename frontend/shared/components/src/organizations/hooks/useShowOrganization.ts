import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { LimitedFilteredRequest } from '@stamhoofd/structures';
import { PromiseView } from '../../containers';
import { useOrganizationsObjectFetcher } from '../../fetchers';
import { Toast } from '../../overlays/Toast';

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
                        Toast.error($t(`6350b2c6-ab40-4a92-873e-f667386055a4`)).show();
                        throw new Error('Organization not found');
                    }
                    const OrganizationView = (await import('@stamhoofd/admin-frontend/src/views/organizations/OrganizationView.vue')).default;
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
