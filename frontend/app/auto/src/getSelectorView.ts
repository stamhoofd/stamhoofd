import { ComponentWithProperties, ModalStackComponent, NavigationController } from '@simonbackx/vue-app-navigation';
import { CoverImageContainer, AuthenticatedView, getLoginRoot } from '@stamhoofd/components';
import OrganizationSelectionView from './OrganizationSelectionView.vue';

function wrapWithModalStack(component: ComponentWithProperties) {
    return new ComponentWithProperties(ModalStackComponent, { root: component });
}

export async function getSelectorView() {
    let baseRoot = new ComponentWithProperties(CoverImageContainer, {
        root: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(OrganizationSelectionView, {}),
        }),
    });

    if (STAMHOOFD.userMode === 'platform') {
        // In platform mode, we need authentication
        baseRoot = new ComponentWithProperties(AuthenticatedView, {
            root: wrapWithModalStack(baseRoot),

            // If a user gets logged out on the organization selection root, we'll replace the root with the auto selection root
            // This is because we want the user to automatically go to the right place after signing in
            loginRoot: wrapWithModalStack(getLoginRoot()),
        });
    }

    return baseRoot;
}
