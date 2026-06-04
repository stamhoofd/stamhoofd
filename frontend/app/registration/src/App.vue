<template>
    <ComponentWithPropertiesInstance :component="root" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, ComponentWithPropertiesInstance, ModalStackComponent } from '@simonbackx/vue-app-navigation';
import PromiseView from '@stamhoofd/components/containers/PromiseView.vue';
import TabBarController from '@stamhoofd/components/containers/TabBarController.vue';
import { TabBarItem } from '@stamhoofd/components/containers/TabBarItem.ts';
import { manualFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { computed } from 'vue';

import CartView from './views/cart/CartView.vue';
import MemberCommunicationView from './views/communication/MemberCommunicationView.vue';
import EventsOverview from './views/events/EventsOverview.vue';
import StartView from './views/start/StartView.vue';
import { usePlatformManager, useMemberManager } from '@stamhoofd/networking';
import { AuthenticatedView, getLoginRoot, useContext } from '@stamhoofd/components';

const context = useContext();
const platformManager = usePlatformManager();
const memberManager = useMemberManager();

function wrapWithModalStack(component: ComponentWithProperties) {
    return new ComponentWithProperties(ModalStackComponent, { root: component });
}

const root = new ComponentWithProperties(AuthenticatedView, {
    loginRoot: wrapWithModalStack(getLoginRoot()),
    root: wrapWithModalStack(getRoot()),
});
root.setCheckRoutes(); // DISCLAIMER waiting for upstream fix

function getRoot() {
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

    return new ComponentWithProperties(PromiseView, {
        promise: async function () {
            await memberManager.loadMembers();
            await memberManager.loadCheckout();
            await memberManager.loadDocuments();

            const enableEvents = platformManager.value.$platform.config.eventTypes.length > 0 && !manualFeatureFlag('disable-events', context.value);

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
                        badge: computed(() => memberManager.family.checkout.cart.count === 0 ? '' : memberManager.family.checkout.cart.count.toFixed(0)),
                    }),
                ],
            });
        },
    });
}
</script>
