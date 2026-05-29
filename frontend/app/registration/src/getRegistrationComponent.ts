import { ComponentWithProperties, ModalStackComponent, NavigationController } from '@simonbackx/vue-app-navigation';
import { ColorHelper } from '@stamhoofd/components/ColorHelper.ts';
import PromiseView from '@stamhoofd/components/containers/PromiseView.vue';
import TabBarController from '@stamhoofd/components/containers/TabBarController.vue';
import { TabBarItem } from '@stamhoofd/components/containers/TabBarItem.ts';
import { manualFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { sessionFromOrganization, wrapContext } from '@stamhoofd/dashboard';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { computed } from 'vue';

import CartView from './views/cart/CartView.vue';
import MemberCommunicationView from './views/communication/MemberCommunicationView.vue';
import EventsOverview from './views/events/EventsOverview.vue';
import StartView from './views/start/StartView.vue';
import type { Organization } from '@stamhoofd/structures';
import { getAuthComponent } from '../../auth/getAuthComponent.ts';
import { SessionManager } from '@stamhoofd/networking/SessionManager';
import type { PlatformManager, SessionContext } from '@stamhoofd/networking';

function buildComponent(session: SessionContext, organization: Organization | null) {
    const startView = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(StartView, {}),
    });

    const cartRoot = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(CartView, {}),
    });

    const calendarTab = new TabBarItem({
        id: 'events',
        icon: 'calendar',
        name: $t(`%uB`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EventsOverview, {}),
        }),
    });

    const communicationTab = new TabBarItem({
        id: 'communication',
        icon: 'email-filled',
        name: $t(`%1DK`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberCommunicationView, {}),
        }),
    });

    return (platformManager: PlatformManager) => new ComponentWithProperties(PromiseView, {
        promise: async function (this: PromiseView) {
            const $memberManager = this.$memberManager;
            await $memberManager.loadMembers();
            await $memberManager.loadCheckout();
            await $memberManager.loadDocuments();

            const enableEvents = platformManager.$platform.config.eventTypes.length > 0 && !manualFeatureFlag('disable-events', session);

            return new ComponentWithProperties(TabBarController, {
                tabs: [
                    new TabBarItem({
                        id: 'start',
                        icon: 'home',
                        name: $t(`%I`),
                        component: startView,
                    }),
                    ...(enableEvents ? [calendarTab] : []),
                    communicationTab,
                    new TabBarItem({
                        id: 'cart',
                        icon: 'basket',
                        name: $t(`%X5`),
                        component: cartRoot,
                        badge: computed(() => $memberManager.family.checkout.cart.count === 0 ? '' : $memberManager.family.checkout.cart.count.toFixed(0)),
                    }),
                ],
            });
        },
    });
}

export default async function getRegistrationComponent(organization: Organization | null) {
    if (!organization && STAMHOOFD.userMode === 'organization') {
        throw new Error('Organization should be provided in organization mode when building registration component');
    }

    const session = organization ? await sessionFromOrganization({ organization }) : await SessionManager.getLastGlobalSession();

    if (organization) {
        await I18nController.loadDefault(session, Country.Belgium, Language.Dutch, organization.address?.country);

        // Set color
        if (organization.meta.color) {
            ColorHelper.setColor(organization.meta.color);
        }
    }

    const root = buildComponent(session, organization);

    return wrapContext(session, 'registration', async ({ platformManager }) => await getAuthComponent(root(platformManager), organization), { ownDomain: true });
}
