import { ComponentWithProperties, ModalStackComponent, NavigationController } from '@simonbackx/vue-app-navigation';
import { CoverImageContainer, PermissionsCheckedView } from '@stamhoofd/components';
import { sessionFromOrganization, wrapContext } from '@stamhoofd/dashboard';
import { getDashboardComponent } from '@stamhoofd/dashboard/src/getDashboardComponent';
import { SessionManager } from '@stamhoofd/networking';
import type { Organization } from '@stamhoofd/structures';
import OrganizationSelectionView from '../../dashboard/src/views/login/OrganizationSelectionView.vue';
import { getAuthComponent } from '../../auth/getAuthComponent.js';
import getRegistrationComponent from '@stamhoofd/registration/src/getRegistrationComponent.ts';

function wrapWithModalStack(component: ComponentWithProperties) {
    return new ComponentWithProperties(ModalStackComponent, { root: component });
}

export async function getUnscopedSwitcherComponent() {
    const session = await SessionManager.getLastGlobalSession();

    // if not on own dashboard domain, go to dashboard domain

    let base = new ComponentWithProperties(CoverImageContainer, {
        root: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(OrganizationSelectionView, {}),
        }),
    });
    if (STAMHOOFD.userMode === 'platform') {
        // TO DO: if the user is logged in and has no permissions it should go to the member portal
        base = await getAuthComponent(base, null);
    }
    return wrapContext(session, 'auto', () => base);
}

export async function getScopedSwitcherComponent(organization: Organization) {
    const session = await sessionFromOrganization({ organization });

    const root = new ComponentWithProperties(PermissionsCheckedView, {
        root: wrapWithModalStack(await getDashboardComponent(organization)),
        noPermissionsRoot: wrapWithModalStack(await getRegistrationComponent(organization)),
    });

    return wrapContext(session, 'auto', async () => await getAuthComponent(root, organization));
}
