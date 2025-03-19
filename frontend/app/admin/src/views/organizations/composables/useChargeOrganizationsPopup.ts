import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { StamhoofdFilter } from '@stamhoofd/structures';
import ChargeOrganizationsView from '../ChargeOrganizationsView.vue';

export function useChargeOrganizationsPopup() {
    const present = usePresent();

    return {
        present: async (filter: StamhoofdFilter) => {
            await present({
                modalDisplayStyle: 'popup',
                components: [
                    new ComponentWithProperties(ChargeOrganizationsView, {
                        filter,
                    }),
                ],
            });
        },
    };
}
