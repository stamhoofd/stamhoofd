import { ComponentWithProperties, ModalStackComponent, NavigationController } from '@simonbackx/vue-app-navigation';
import { AuthenticatedView } from '@stamhoofd/components';
import { SessionContext } from '@stamhoofd/networking';
import { Webshop, WebshopAuthType } from '@stamhoofd/structures';

import { wrapContext } from '@stamhoofd/dashboard';
import RequiredLoginView from './views/RequiredLoginView.vue';
import WebshopView from './views/WebshopView.vue';

export function wrapWithModalStack(...components: ComponentWithProperties[]) {
    return new ComponentWithProperties(ModalStackComponent, { initialComponents: components });
}

export async function getWebshopRootView(session: SessionContext, webshop: Webshop) {
    // Do we need to require login?
    let root = wrapWithModalStack(new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(WebshopView, {}),
    }));

    if (webshop.meta.authType === WebshopAuthType.Required) {
        root = new ComponentWithProperties(AuthenticatedView, {
            root,
            loginRoot: wrapWithModalStack(new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(RequiredLoginView, {}),
            })),
        });
    }

    return wrapContext(session, 'webshop', root, {
        ownDomain: true,
        webshop,
    });
}
