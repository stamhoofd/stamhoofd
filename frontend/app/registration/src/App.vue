<template>
    <ComponentWithPropertiesInstance :component="root" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, ComponentWithPropertiesInstance, ModalStackComponent, NavigationController, useCurrentComponent } from '@simonbackx/vue-app-navigation';
import { useLoginRoot } from '@stamhoofd/components/auth/useLoginRoot.ts';
import AuthenticatedView from '@stamhoofd/components/containers/AuthenticatedView.vue';
import PromiseView from '@stamhoofd/components/containers/PromiseView.vue';
import TabBarController from '@stamhoofd/components/containers/TabBarController.vue';
import { TabBarItem } from '@stamhoofd/components/containers/TabBarItem.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { useEventTypes } from '@stamhoofd/components/hooks/useEventTypes.ts';
import { manualFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { useMemberManager } from '@stamhoofd/networking/MemberManager';
import { usePlatformManager } from '@stamhoofd/networking/PlatformManager';
import { computed } from 'vue';
import CartView from './views/cart/CartView.vue';
import MemberCommunicationView from './views/communication/MemberCommunicationView.vue';
import EventsOverview from './views/events/EventsOverview.vue';
import StartView from './views/start/StartView.vue';

const context = useContext();
const platformManager = usePlatformManager();
const memberManager = useMemberManager();
const getLoginRoot = useLoginRoot();
const eventTypes = useEventTypes();

function wrapWithModalStack(component: ComponentWithProperties) {
    return new ComponentWithProperties(ModalStackComponent, { root: component });
}

const root = new ComponentWithProperties(AuthenticatedView, {
    loginRoot: getLoginRoot(),
    root: wrapWithModalStack(getRoot()),
});
const component = useCurrentComponent();
if (component?.checkRoutes) {
    root.setCheckRoutes();
}

function areEventsEnabled(): boolean {
    return eventTypes.value.length > 0 && !manualFeatureFlag('disable-events', context.value);
}

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

            return new ComponentWithProperties(TabBarController, {
                tabs: [
                    new TabBarItem({
                        id: 'start',
                        icon: 'home',
                        name: $t(`%I`),
                        component: startView,
                    }),
                    ...(areEventsEnabled() ? [calendarTab] : []),
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
