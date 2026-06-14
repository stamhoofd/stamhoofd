import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import type { StamhoofdFilter } from '@stamhoofd/structures';


export function useChargeOrganizationsPopup() {
    const present = usePresent();

    return {
        present: async (filter: StamhoofdFilter) => {
            await present({
                modalDisplayStyle: 'popup',
                components: [
                    AsyncComponent(() => import('../ChargeOrganizationsView.vue'), {
                        filter,
                    }),
                ],
            });
        },
    };
}
