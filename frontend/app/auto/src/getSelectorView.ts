import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import CoverImageContainer from '@stamhoofd/components/containers/CoverImageContainer.vue';


export async function getSelectorView() {
    return new ComponentWithProperties(CoverImageContainer, {
        root: new ComponentWithProperties(NavigationController, {
            root: AsyncComponent(() => import('./OrganizationSelectionView.vue'), {}),
        }),
    });
}
