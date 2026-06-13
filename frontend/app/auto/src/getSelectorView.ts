import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import CoverImageContainer from '@stamhoofd/components/containers/CoverImageContainer.vue';
import OrganizationSelectionView from './OrganizationSelectionView.vue';

export async function getSelectorView() {
    return new ComponentWithProperties(CoverImageContainer, {
        root: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(OrganizationSelectionView, {}),
        }),
    });
}
