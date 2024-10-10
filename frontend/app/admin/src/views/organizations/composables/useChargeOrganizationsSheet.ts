import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { StamhoofdFilter } from '@stamhoofd/structures';
import ChargeOrganizationsView from '../ChargeOrganizationsView.vue';

export function useChargeOrganizationsSheet() {
    const present = usePresent();

    return {
        present: async (filter: StamhoofdFilter) => {
            await present({
                modalDisplayStyle: 'sheet',
                components: [
                    new ComponentWithProperties(ChargeOrganizationsView, {
                        filter,
                    }),
                ],
            });
        },
    };
}
